import { teaKnowledge } from "@/data/tea/knowledge";
import { teaPriceEvidence, teaProducts, teaSkus } from "@/data/tea/products";
import type { IntentResult, PriceEvidence, RetrievalResult, TeaProduct, TeaSku } from "@/types/tea";

function hasTerm(query: string, term: string) { return query.includes(term.toLowerCase()); }
function matchTerms(query: string, terms: string[]) { return terms.filter((term) => hasTerm(query, term)); }

function productMatch(product: TeaProduct, query: string, intent: IntentResult) {
  let score = 0;
  const reasons: string[] = [];
  const exact = [product.name, ...(product.aliases ?? [])].filter((term) => hasTerm(query, term));
  if (exact.length) { score += 14; reasons.push(`命中茶品：${exact[0]}`); }
  const matches = matchTerms(query, [...product.flavor, ...product.keywords]);
  if (matches.length) { score += Math.min(matches.length, 3) * 4; reasons.push(`匹配风味/关键词：${matches.slice(0, 2).join("、")}`); }
  if (intent.entities.teaType === product.category) { score += 7; reasons.push(`匹配茶类：${product.category}`); }
  if (intent.entities.scene && product.scene.includes(intent.entities.scene)) { score += 4; reasons.push(`匹配场景：${intent.entities.scene}`); }
  return { score, reasons };
}

function skuMatch(sku: TeaSku, query: string) {
  let score = 0;
  const reasons: string[] = [];
  if (hasTerm(query, sku.name.toLowerCase())) { score += 16; reasons.push("命中具体商品组合"); }
  const combinationParts = sku.name.split(/[＋+]/).map((part) => part.replace("双拼", "").trim()).filter(Boolean);
  if (combinationParts.length > 1 && combinationParts.every((part) => hasTerm(query, part))) {
    score += 16;
    reasons.push("命中双拼茶品组合");
  }
  const matches = matchTerms(query, [sku.spec, sku.netContent, sku.packaging]);
  if (matches.length) { score += matches.length * 4; reasons.push(`匹配规格/包装：${matches.join("、")}`); }
  if (sku.priceRelationGroup && (hasTerm(query, "双拼") || hasTerm(query, "双盒") || hasTerm(query, "单罐"))) { score += 7; reasons.push("命中已确认商品价格关系"); }
  return { score, reasons };
}

function priceMatch(price: PriceEvidence, query: string) {
  let score = 0;
  const reasons: string[] = [];
  if (hasTerm(query, price.skuName)) { score += 16; reasons.push(`命中具体SKU：${price.skuName}`); }
  if (hasTerm(query, price.productName)) { score += 10; reasons.push(`命中茶品：${price.productName}`); }
  const exactCombination = price.combinationTerms?.every((term) => hasTerm(query, term));
  const aliasedCombination = price.combinationTermGroups?.every((group) => group.some((term) => hasTerm(query, term)));
  if (exactCombination || aliasedCombination) { score += 16; reasons.push("命中商品组合"); }
  const keywordMatches = matchTerms(query, price.keywords ?? []);
  if (keywordMatches.length) { score += Math.min(keywordMatches.length, 3) * 5; reasons.push(`匹配价格关键词：${keywordMatches.slice(0, 2).join("、")}`); }
  if (hasTerm(query, price.netContent)) { score += 10; reasons.push(`命中净含量：${price.netContent}`); }
  if (hasTerm(query, price.packaging)) { score += 3; reasons.push(`匹配包装：${price.packaging}`); }
  if (hasTerm(query, "价格") || hasTerm(query, "多少钱")) score += 2;
  return { score, reasons };
}

/** 当前为本地规则检索；默认只读取 data/tea 中有 V1.1 资料来源支持的数据。 */
export function retrieveTeaKnowledge(query: string, intent: IntentResult): RetrievalResult {
  const normalized = query.toLowerCase();
  const products = teaProducts.map((product) => {
    const { score, reasons } = productMatch(product, normalized, intent);
    return { ...product, relatedSkus: teaSkus.filter((sku) => sku.productIds.includes(product.id)), score, matchReasons: reasons };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  const skus = teaSkus.map((sku) => {
    const { score, reasons } = skuMatch(sku, normalized);
    return { ...sku, score, matchReasons: reasons };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const prices = teaPriceEvidence.map((price) => {
    const { score, reasons } = priceMatch(price, normalized);
    return { ...price, score, matchReasons: reasons };
  }).filter((item) => item.score >= 12).sort((a, b) => b.score - a.score).slice(0, 3);
  const knowledge = teaKnowledge.map((document) => {
    let score = 0;
    const reasons: string[] = [];
    const matches = matchTerms(normalized, document.keywords);
    if (matches.length) { score += Math.min(matches.length, 3) * 4; reasons.push(`命中知识关键词：${matches.slice(0, 2).join("、")}`); }
    if (intent.intent === "brewing_question" && document.knowledgeType === "brewing") { score += 12; reasons.push("匹配冲泡场景"); }
    if (intent.intent === "gift_recommendation" && document.knowledgeType === "recommendation") { score += 8; reasons.push("匹配推荐场景"); }
    if (document.knowledgeType === "sku" && skus.length) { score += 4; reasons.push("关联SKU资料"); }
    return { ...document, score, matchReasons: reasons };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  return { products, skus, prices, knowledge };
}
