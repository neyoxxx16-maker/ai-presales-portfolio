import { teaKnowledge } from "@/data/tea/knowledge";
import { teaPriceEvidence } from "@/data/tea/products";
import { classifyTeaIntent } from "@/lib/tea-intent";
import { deepSeekProvider, isDeepSeekConfigured } from "@/lib/rag/deepseek-provider";
import { embedLocally } from "@/lib/rag/local-embeddings";
import { loadTeaVectorIndex, RAG_CONFIG, searchTeaVectorIndex } from "@/lib/rag/vector-store";
import type { GroundedOutput, RagRequest } from "@/lib/rag/types";
import type { TeaAnswer, TeaResponseMode, TeaTurnResult } from "@/types/tea";

const ragIntents = new Set(["product_question", "product_fit", "product_compare", "brewing_question", "brand_question", "product_recommendation"]);
const categoryByIntent: Record<string, string[]> = { brewing_question: ["brewing"], product_question: ["tea_type"], product_fit: ["tea_type", "recommendation"], product_compare: ["tea_type"], brand_question: ["brand_profile"], product_recommendation: ["tea_type", "recommendation"] };
const unique = <T,>(items: T[]) => [...new Set(items)];

function structuredFacts(answer: TeaAnswer) {
  const skuFacts = (answer.recommendationSkus ?? []).flatMap((sku) => {
    const prices = teaPriceEvidence.filter((price) => sku.priceEvidenceIds?.includes(price.id));
    return prices.map((price) => `${sku.name}｜${sku.spec}｜${sku.netContent}｜${price.priceType === "new_customer" ? "新客价" : "售价"} ¥${price.amount}${price.originalPrice ? `｜划线价 ¥${price.originalPrice}` : ""}`);
  });
  return unique([...skuFacts, ...answer.sources.map((source) => `${source.title}：${source.excerpt}`)]);
}

function promptFor(request: RagRequest, knowledge: string) {
  return `你是一叶春山 AI 导购 POC。只能依据 STRUCTURED FACTS 与 RETRIEVED KNOWLEDGE 回答，不得使用外部常识补充品牌、SKU、价格、库存、产区、优惠、物流、医疗功效或销售数据。结构化事实优先，绝不能改写其中的价格、规格、包装或商品。资料不足时明确说明无法确认。仅输出合法 JSON：{"answer":"...","citations":["KB..."],"confidence":"high|medium|low","followUp":"可选"}。\n\nSTRUCTURED FACTS:\n${request.structuredFacts.join("\n") || "无"}\n\nRETRIEVED KNOWLEDGE:\n${knowledge}\n\nUSER QUERY:\n${request.query}`;
}

function validateGroundedOutput(output: GroundedOutput, request: RagRequest) {
  if (!output || typeof output.answer !== "string" || !["high", "medium", "low"].includes(output.confidence)) return undefined;
  const citations = unique((output.citations ?? []).filter((id) => request.allowedCitationIds.includes(id)));
  if (!citations.length) return undefined;
  const allowedPrices = request.structuredFacts.flatMap((fact) => [...fact.matchAll(/¥\s*(\d+(?:\.\d+)?)/g)].map((match) => match[1]));
  const mentionedPrices = [...output.answer.matchAll(/¥\s*(\d+(?:\.\d+)?)/g)].map((match) => match[1]);
  if (mentionedPrices.some((price) => !allowedPrices.includes(price))) return undefined;
  return { ...output, citations };
}

function withMode(answer: TeaAnswer, mode: TeaResponseMode) { return { ...answer, mode, execution: answer.execution.map((step) => step.label === "生成回答" ? { ...step, detail: mode === "live-rag" ? "已完成（实时 RAG）" : step.detail } : step) }; }

export async function enhanceWithLiveRag(query: string, turn: TeaTurnResult) {
  const intent = classifyTeaIntent(query).intent;
  if (!isDeepSeekConfigured() || !ragIntents.has(intent) || turn.state.pendingDialog) return withMode(turn.answer, "structured");
  try {
    const index = await loadTeaVectorIndex();
    if (!index) return withMode(turn.answer, "fallback");
    const queryEmbedding = (await embedLocally([query]))[0];
    const productIds = turn.answer.recommendations.flatMap((product) => [product.id]);
    const retrieval = searchTeaVectorIndex(index, queryEmbedding, { productIds, categories: categoryByIntent[intent] });
    if (retrieval.insufficientContext) return withMode(turn.answer, "fallback");
    const request: RagRequest = { query, intent, productIds, structuredFacts: structuredFacts(turn.answer), allowedCitationIds: retrieval.hits.map((hit) => hit.id) };
    const groundedPrompt = promptFor(request, retrieval.hits.map((hit) => `[${hit.id}] ${hit.title}\n${hit.content}`).join("\n\n"));
    const output = validateGroundedOutput(await deepSeekProvider.generate(groundedPrompt, query), request);
    if (!output) return withMode(turn.answer, "fallback");
    const sources = output.citations.map((id) => teaKnowledge.find((document) => document.id === id)).filter((document): document is NonNullable<typeof document> => Boolean(document)).map((document) => ({ ...document, score: 100, matchReasons: ["实时 RAG 引用"] }));
    return { ...withMode(turn.answer, "live-rag"), answer: output.followUp ? `${output.answer}\n${output.followUp}` : output.answer, sources };
  } catch {
    return withMode(turn.answer, "fallback");
  }
}

export { RAG_CONFIG, validateGroundedOutput };
