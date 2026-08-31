import { finalizeContent, getProductFacts } from "@/lib/ecommerce-agent/tools";
import { buildContentPackage } from "@/lib/ecommerce-agent/content-package";
import type { EcommerceAgentErrorCode, EcommerceAgentRequest, EcommerceAgentResult, EcommerceProductFacts, EcommerceTaskType } from "@/types/ecommerce-agent";

type ToolCall = { id?: string; type?: string; function?: { name?: string; arguments?: string } };
type ModelMessage = { role?: string; content?: unknown; tool_calls?: ToolCall[] };
type ModelRequest = { messages: Array<Record<string, unknown>>; tools: unknown[]; toolChoice: unknown };
export type EcommerceAgentModel = { complete: (request: ModelRequest) => Promise<ModelMessage> };

export class EcommerceAgentError extends Error {
  constructor(public readonly code: EcommerceAgentErrorCode) { super(code); }
}

const taskLabels: Record<EcommerceTaskType, string> = {
  selling_points: "商品卖点文案",
  xiaohongshu: "小红书种草文案",
  product_detail: "商品详情页文案",
  customer_service: "客服推荐话术",
};

const toolDefinitions = {
  getFacts: [{ type: "function", function: { name: "get_product_facts", description: "读取某个 SKU 的已验证商品事实。", strict: true, parameters: { type: "object", properties: { skuId: { type: "string" } }, required: ["skuId"], additionalProperties: false } } }],
  finalize: [{ type: "function", function: { name: "finalize_content", description: "提交候选文案，由服务端执行参数校验、风险审核并构造最终审核结果。", strict: true, parameters: { type: "object", properties: { candidateContent: { type: "string" } }, required: ["candidateContent"], additionalProperties: false } } }],
};

function configuration() { return { key: process.env.DEEPSEEK_API_KEY, baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""), model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash" }; }

const deepSeekEcommerceModel: EcommerceAgentModel = {
  async complete(request) {
    const { key, baseUrl, model } = configuration();
    if (!key) throw new EcommerceAgentError("provider_unavailable");
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages: request.messages, tools: request.tools, tool_choice: request.toolChoice, thinking: { type: "disabled" }, stream: false, temperature: 0.3, max_tokens: 900 }), signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new EcommerceAgentError("provider_failed");
      const payload = await response.json() as { choices?: Array<{ message?: ModelMessage }> };
      const message = payload.choices?.[0]?.message;
      if (!message) throw new EcommerceAgentError("provider_malformed");
      return message;
    } catch (error) {
      if (error instanceof EcommerceAgentError) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") throw new EcommerceAgentError("provider_timeout");
      throw new EcommerceAgentError("provider_failed");
    }
  },
};

function parseToolArguments(call: ToolCall) {
  if (!call.function?.arguments) throw new EcommerceAgentError("provider_malformed");
  try { return JSON.parse(call.function.arguments) as Record<string, unknown>; } catch { throw new EcommerceAgentError("provider_malformed"); }
}

function firstToolCall(message: ModelMessage, name: string) {
  const call = message.tool_calls?.find((item) => item.function?.name === name);
  if (!call) throw new EcommerceAgentError("provider_malformed");
  return call;
}

function requestIsValid(request: EcommerceAgentRequest): boolean {
  return Boolean(request.skuId && taskLabels[request.taskType] && [request.style, request.audience, request.scene, request.length, request.requirements, request.referenceText, request.customStyle].every((value) => value === undefined || (typeof value === "string" && value.length <= 3000)) && (!request.sellingPoints || (Array.isArray(request.sellingPoints) && request.sellingPoints.length <= 3)));
}

function systemPrompt() {
  return "你是电商内容 Agent。商品事实只能来自 get_product_facts 工具返回值；未提供的产区、库存、销量、优惠、物流、功效等必须不写。你要写自然、克制的中文商业文案。不要输出最终聊天文本；必须按指令调用函数。";
}

function userRequest(request: EcommerceAgentRequest) {
  return JSON.stringify({ task: taskLabels[request.taskType], style: request.style || "未指定", targetAudience: request.audience || "未指定", useScene: request.scene || "未指定", length: request.length || "未指定", additionalRequirements: request.requirements || "无" });
}

function toolMessage(call: ToolCall, content: unknown) { return { role: "tool", tool_call_id: call.id ?? "local-tool", content: JSON.stringify(content) }; }

export async function runEcommerceAgent(request: EcommerceAgentRequest, model: EcommerceAgentModel = deepSeekEcommerceModel): Promise<EcommerceAgentResult> {
  if (!requestIsValid(request)) throw new EcommerceAgentError("invalid_request");
  if (!getProductFacts(request.skuId)) throw new EcommerceAgentError("product_not_found");
  const workflow: EcommerceAgentResult["workflow"] = [];
  const initialMessages: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt() }, { role: "user", content: userRequest(request) }];
  const factMessage = await model.complete({ messages: initialMessages, tools: toolDefinitions.getFacts, toolChoice: { type: "function", function: { name: "get_product_facts" } } });
  const factCall = firstToolCall(factMessage, "get_product_facts");
  parseToolArguments(factCall);
  // 商品选择以用户在界面中明确选择的 SKU 为准；不允许模型改写工具读取目标。
  const facts = getProductFacts(request.skuId);
  if (!facts) throw new EcommerceAgentError("product_not_found");
  workflow.push({ id: "get_product_facts", label: "获取商品事实", status: "completed", detail: `已从已验证知识库读取 ${facts.skuName}。` });

  const candidateMessages: Array<Record<string, unknown>> = [...initialMessages, { role: "assistant", content: factMessage.content ?? "", tool_calls: factMessage.tool_calls ?? [] }, toolMessage(factCall, facts), { role: "user", content: "请只依据上述商品事实生成候选文案，并调用 finalize_content 提交候选文案。" }];
  const finalMessage = await model.complete({ messages: candidateMessages, tools: toolDefinitions.finalize, toolChoice: { type: "function", function: { name: "finalize_content" } } });
  const finalizeCall = firstToolCall(finalMessage, "finalize_content");
  const finalizeArgs = parseToolArguments(finalizeCall);
  const candidateContent = typeof finalizeArgs.candidateContent === "string" ? finalizeArgs.candidateContent.trim() : "";
  if (!candidateContent || candidateContent.length > 2400) throw new EcommerceAgentError("tool_failed");
  workflow.push({ id: "generate_candidate", label: "生成候选内容", status: "completed", detail: "DeepSeek 已通过 Function Calling 提交候选文案。" });
  const result = finalizeContent(candidateContent, facts, request.taskType);
  const contentPackage = buildContentPackage(facts, request, candidateContent);
  workflow.push({ id: "validate_product_claims", label: "参数一致性校验", status: "completed", detail: result.validation.passed ? "SKU、规格、包装与价格均与商品事实一致。" : `发现 ${result.validation.issues.length} 个参数问题。` });
  workflow.push({ id: "scan_content_risk", label: "风险审核", status: "completed", detail: result.riskReview.level === "low" ? "未发现明显风险。" : `风险等级：${result.riskReview.level === "block" ? "阻止发布" : "需注意"}。` });
  workflow.push({ id: "finalize_content", label: "生成结构化结果", status: "completed", detail: result.status === "ready_for_review" ? "已生成内容策略、脚本、拍摄与审核方案，待人工确认。" : "需要修订后再进入人工确认。" });
  return { ...result, workflow, contentPackage };
}

export function isEcommerceAgentResult(value: unknown): value is EcommerceAgentResult {
  const result = value as Partial<EcommerceAgentResult>;
  return Boolean(result && typeof result.generatedContent === "string" && result.product && typeof result.product.skuId === "string" && result.validation && typeof result.validation.passed === "boolean" && Array.isArray(result.validation.issues) && result.riskReview && ["low", "attention", "block"].includes(result.riskReview.level ?? "") && ["ready_for_review", "needs_revision", "blocked"].includes(result.status ?? "") && Array.isArray(result.workflow) && (!result.contentPackage || Array.isArray(result.contentPackage.titles)));
}

export { taskLabels };
