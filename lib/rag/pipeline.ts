import { teaKnowledge } from "@/data/tea/knowledge";
import { teaPriceEvidence, teaSkus } from "@/data/tea/products";
import { classifyTeaIntent } from "@/lib/tea-intent";
import { deepSeekProvider, isDeepSeekConfigured } from "@/lib/rag/deepseek-provider";
import { embedTexts, embeddingProviderStatus } from "@/lib/rag/embedding-provider";
import { loadTeaVectorIndex, RAG_CONFIG, searchTeaVectorIndex } from "@/lib/rag/vector-store";
import type { GroundedOutput, RagRequest } from "@/lib/rag/types";
import type { TeaAnswer, TeaResponseMode, TeaTurnResult } from "@/types/tea";

// SKU recommendation, counting and filtering use the deterministic structured catalog.
// RAG remains available for explanatory tea knowledge, but may not replace SKU routing.
const ragIntents = new Set(["product_question", "product_fit", "product_compare", "brewing_question", "brand_question"]);
const categoryByIntent: Record<string, string[]> = { brewing_question: ["brewing"], product_question: ["tea_type"], product_fit: ["tea_type", "recommendation"], product_compare: ["tea_type"], brand_question: ["brand_profile"], product_recommendation: ["tea_type", "recommendation"] };
const unique = <T,>(items: T[]) => [...new Set(items)];

function structuredFacts(answer: TeaAnswer) {
  const skuFacts = (answer.recommendationSkus ?? []).flatMap((sku) => {
    const prices = teaPriceEvidence.filter((price) => sku.priceEvidenceIds?.includes(price.id));
    return prices.map((price) => `${sku.name}｜${sku.spec}｜${sku.netContent}｜${sku.packaging}｜${price.priceType === "new_customer" ? "新客价" : "售价"} ¥${price.amount}${price.originalPrice ? `｜划线价 ¥${price.originalPrice}` : ""}`);
  });
  return unique([...skuFacts, ...answer.sources.map((source) => `${source.title}：${source.excerpt}`)]);
}

function promptFor(request: RagRequest, knowledge: string) {
  return `你是一叶春山 AI 导购 POC。只能依据 STRUCTURED FACTS 与 RETRIEVED KNOWLEDGE 回答，不得使用外部常识补充品牌、SKU、价格、库存、产区、优惠、物流、医疗功效或销售数据。结构化事实优先，绝不能改写其中的价格、规格、包装或商品。若 STRUCTURED FACTS 包含商品或 SKU，回答只能解释这些已给出的候选，禁止新增、替换或比较任何其他商品；不要把检索资料中的其他商品变成推荐。回答保持简洁。资料不足时明确说明无法确认。仅输出合法 JSON：{"answer":"...","citations":["KB..."],"confidence":"high|medium|low","followUp":"可选"}。\n\nSTRUCTURED FACTS:\n${request.structuredFacts.join("\n") || "无"}\n\nRETRIEVED KNOWLEDGE:\n${knowledge}\n\nUSER QUERY:\n${request.query}`;
}

function validateGroundedOutput(output: GroundedOutput, request: RagRequest) {
  if (!output || typeof output.answer !== "string" || !["high", "medium", "low"].includes(output.confidence)) return undefined;
  const citations = unique((output.citations ?? []).filter((id) => request.allowedCitationIds.includes(id)));
  if (!citations.length) return undefined;
  const skuFacts = request.structuredFacts.map((fact) => fact.split("｜")).filter((parts) => parts.length >= 5);
  const allowed = {
    products: skuFacts.map(([product]) => product),
    specifications: unique(skuFacts.flatMap(([, specification, netContent]) => [specification, netContent])),
    packagings: unique(skuFacts.map(([, , , packaging]) => packaging)),
    priceTypes: unique(skuFacts.flatMap((parts) => parts.filter((part) => /(?:售价|新客价|划线价)/.test(part)).map((part) => part.replace(/\s*¥.*$/, "")))),
  };
  const conflictsWithStructuredFacts = (knownValues: string[], allowedValues: string[]) => allowedValues.length > 0 && knownValues.some((value) => output.answer.includes(value) && !allowedValues.includes(value));
  if (conflictsWithStructuredFacts(teaSkus.map((sku) => sku.name), allowed.products)) return undefined;
  const weightTerms = (values: string[]) => unique(values.flatMap((value) => value.match(/\d+(?:\.\d+)?g/gi) ?? []));
  if (conflictsWithStructuredFacts(weightTerms(teaSkus.flatMap((sku) => [sku.spec, sku.netContent])), weightTerms(allowed.specifications))) return undefined;
  if (conflictsWithStructuredFacts(unique(teaSkus.map((sku) => sku.packaging)), allowed.packagings)) return undefined;
  if (conflictsWithStructuredFacts(["售价", "新客价", "划线价"], allowed.priceTypes)) return undefined;
  const allowedPrices = request.structuredFacts.flatMap((fact) => [...fact.matchAll(/¥\s*(\d+(?:\.\d+)?)/g)].map((match) => match[1]));
  const mentionedPrices = [...output.answer.matchAll(/¥\s*(\d+(?:\.\d+)?)/g)].map((match) => match[1]);
  if (mentionedPrices.some((price) => !allowedPrices.includes(price))) return undefined;
  return { ...output, citations };
}

function withMode(answer: TeaAnswer, mode: TeaResponseMode) { return { ...answer, mode, execution: answer.execution.map((step) => step.label === "生成回答" ? { ...step, detail: mode === "live-rag" ? "已完成（实时 Hybrid RAG）" : step.detail } : step) }; }

function isStrictProductionRag() {
  return process.env.NODE_ENV === "production" && process.env.EMBEDDING_PROVIDER === "openai-compatible";
}

function ragUnavailable(answer: TeaAnswer, status: "RAG_UNAVAILABLE" | "PRODUCTION_RAG_CONFIG_ERROR", detail: string) {
  return {
    ...withMode(answer, "rag-unavailable"),
    ragStatus: status,
    ragError: detail,
    execution: [...answer.execution, { label: "实时 RAG 状态", detail: `${status} · ${detail}`, status: "empty" as const }],
  };
}

function addHybridTrace(answer: TeaAnswer, retrieval: { keywordHits: number; vectorHits: number; hybridActive: boolean }) {
  return {
    ...answer,
    ragStatus: retrieval.hybridActive ? "HYBRID_RAG_ACTIVE" as const : undefined,
    execution: [
      ...answer.execution,
      { label: "关键词检索", detail: `已完成 · ${retrieval.keywordHits} 条关键词命中`, status: "completed" as const },
      { label: "向量检索", detail: `已完成 · ${retrieval.vectorHits} 条向量排序结果`, status: "completed" as const },
      { label: "Hybrid / RRF 融合", detail: retrieval.hybridActive ? "HYBRID_RAG_ACTIVE · 已融合关键词与向量排序" : "已完成 · 本轮关键词未命中，保留向量排序结果", status: "completed" as const },
    ],
  };
}

export async function enhanceWithLiveRag(query: string, turn: TeaTurnResult) {
  const intent = classifyTeaIntent(query).intent;
  if (!isDeepSeekConfigured() || !ragIntents.has(intent) || turn.state.pendingDialog) return withMode(turn.answer, "structured");
  try {
    const strict = isStrictProductionRag();
    const index = await loadTeaVectorIndex();
    if (!index) return strict ? ragUnavailable(turn.answer, "PRODUCTION_RAG_CONFIG_ERROR", "Production 512d Index 缺失。") : withMode(turn.answer, "fallback");
    const provider = embeddingProviderStatus();
    const invalidProductionConfig = !provider.enabled || provider.provider !== "openai-compatible" || provider.model !== "text-embedding-v4" || provider.dimensions !== 512 || index.model !== "text-embedding-v4" || index.dimensions !== 512 || index.chunks.some((chunk) => chunk.embedding.length !== 512);
    if (strict && invalidProductionConfig) return ragUnavailable(turn.answer, "PRODUCTION_RAG_CONFIG_ERROR", "Production RAG 必须使用 text-embedding-v4 与完整 512d Index。");
    if (!provider.enabled || index.model !== provider.model || index.dimensions !== provider.dimensions) return withMode(turn.answer, "fallback");
    const queryEmbedding = (await embedTexts([query]))[0];
    if (queryEmbedding.length !== index.dimensions) return strict ? ragUnavailable(turn.answer, "PRODUCTION_RAG_CONFIG_ERROR", "Query Embedding 维度与 Production Index 不一致。") : withMode(turn.answer, "fallback");
    const productIds = turn.answer.recommendations.flatMap((product) => [product.id]);
    const retrieval = searchTeaVectorIndex(index, queryEmbedding, { query, productIds, categories: categoryByIntent[intent] });
    if (retrieval.insufficientContext) return strict ? ragUnavailable(turn.answer, "RAG_UNAVAILABLE", "关键词与向量检索未获得足够的可引用资料。") : withMode(turn.answer, "fallback");
    const request: RagRequest = { query, intent, productIds, structuredFacts: structuredFacts(turn.answer), allowedCitationIds: retrieval.hits.map((hit) => hit.id) };
    const groundedPrompt = promptFor(request, retrieval.hits.map((hit) => `[${hit.id}] ${hit.title}\n${hit.content}`).join("\n\n"));
    let output = validateGroundedOutput(await deepSeekProvider.generate(groundedPrompt, query), request);
    if (!output && request.structuredFacts.length) {
      const repairPrompt = `${groundedPrompt}\n\n上一次 JSON 未通过事实校验。现在必须重新输出 JSON：删除一切未出现在 STRUCTURED FACTS 中的商品、SKU、价格、规格和包装；不得新增候选商品；citations 仅能使用 RETRIEVED KNOWLEDGE 中的 ID。`;
      output = validateGroundedOutput(await deepSeekProvider.generate(repairPrompt, query), request);
    }
    if (!output) return strict ? ragUnavailable(turn.answer, "RAG_UNAVAILABLE", "DeepSeek 输出未通过引用与结构化事实校验。") : withMode(turn.answer, "fallback");
    const sources = output.citations.map((id) => teaKnowledge.find((document) => document.id === (id.startsWith("SKU-") ? "KB006" : id))).filter((document): document is NonNullable<typeof document> => Boolean(document)).map((document) => ({ ...document, score: 100, matchReasons: ["实时 RAG 引用"] }));
    return { ...withMode(addHybridTrace(turn.answer, retrieval), "live-rag"), answer: output.followUp ? `${output.answer}\n${output.followUp}` : output.answer, sources, ragStatus: retrieval.hybridActive ? "HYBRID_RAG_ACTIVE" : undefined };
  } catch (error) {
    if (isStrictProductionRag()) return ragUnavailable(turn.answer, "RAG_UNAVAILABLE", error instanceof Error ? error.message : "Remote Embedding 或 RAG Provider 不可用。");
    return withMode(turn.answer, "fallback");
  }
}

export { RAG_CONFIG, validateGroundedOutput };
