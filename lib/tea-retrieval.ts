import { teaKnowledge } from "@/data/tea/knowledge";
import { teaPriceEvidence, teaProducts, teaSkus } from "@/data/tea/products";
import type { IntentResult, KnowledgeType, PriceEvidence, RetrievalResult, TeaIntent, TeaProduct, TeaSku } from "@/types/tea";

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
  const matches = matchTerms(query, [sku.spec, sku.netContent, sku.packaging, sku.packageType]);
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

const knowledgeTypesByIntent: Record<TeaIntent, KnowledgeType[]> = {
  product_question: ["tea_type", "sku"],
  product_fit: ["tea_type", "recommendation", "sku"],
  gift_catalog: ["sku", "recommendation"],
  product_browse: ["sku", "tea_type"],
  product_existence: ["sku", "tea_type"],
  product_recommendation: ["recommendation", "tea_type", "sku"],
  price_query: ["sku"],
  price_reverse_lookup: ["sku"],
  price_compare: ["sku"],
  price_extreme: ["sku"],
  quantity_price_calc: ["sku"],
  product_compare: ["tea_type"],
  brewing_question: ["brewing"],
  brand_question: ["brand_profile", "conflict_log"],
  aftersales: ["aftersales", "conflict_log"],
  unknown: ["conflict_log"],
};

/** 当前为本地规则检索；默认只读取 data/tea 中有 V1.1 资料来源支持的数据。 */
export function retrieveTeaKnowledge(query: string, intent: IntentResult): RetrievalResult {
  const normalized = query.toLowerCase();
  const products = teaProducts.map((product) => {
    const { score, reasons } = productMatch(product, normalized, intent);
    return { ...product, relatedSkus: teaSkus.filter((sku) => sku.productIds.includes(product.id)), score, matchReasons: reasons };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  const skuCandidates = teaSkus.filter((sku) => {
    const productsForSku = sku.productIds.map((id) => teaProducts.find((product) => product.id === id)).filter(Boolean);
    if (intent.entities.packageType && sku.packageType !== intent.entities.packageType) return false;
    if (intent.entities.requiredPackaging && sku.packaging !== intent.entities.requiredPackaging) return false;
    if (intent.entities.excludedPackaging?.includes(sku.packaging)) return false;
    if (intent.entities.netContent && sku.netContent !== intent.entities.netContent) return false;
    if (intent.entities.exactWeightGrams !== undefined && sku.netWeightGrams !== intent.entities.exactWeightGrams) return false;
    if (intent.entities.maxWeightGrams !== undefined && sku.netWeightGrams > intent.entities.maxWeightGrams) return false;
    if (intent.entities.excludedProductIds?.some((id) => sku.productIds.includes(id))) return false;
    if (intent.entities.excludedTeaTypes?.some((category) => productsForSku.some((product) => product?.category === category))) return false;
    if (intent.entities.requiredTeaTypes?.length && !productsForSku.every((product) => intent.entities.requiredTeaTypes?.includes(product?.category ?? "绿茶"))) return false;
    if (intent.entities.productIds?.length && !(intent.entities.productIds.length > 1
      ? intent.entities.productIds.every((id) => sku.productIds.includes(id))
      : sku.productIds.includes(intent.entities.productIds[0]))) return false;
    if (intent.entities.includedTeaTypes?.length && !sku.productIds.some((id) => intent.entities.includedTeaTypes?.includes(teaProducts.find((product) => product.id === id)?.category ?? "绿茶"))) return false;
    if (intent.entities.includedProductIds?.length && !sku.productIds.some((id) => intent.entities.includedProductIds?.includes(id))) return false;
    return true;
  });
  const scoredSkus = skuCandidates.map((sku) => {
    const { score, reasons } = skuMatch(sku, normalized);
    return { ...sku, score, matchReasons: reasons };
  });
  const catalogIntent = intent.intent === "product_browse" || intent.intent === "gift_catalog";
  const skus = scoredSkus
    .filter((item) => item.score > 0 || catalogIntent)
    .map((item) => item.score > 0 ? item : { ...item, score: 1, matchReasons: ["结构化目录候选"] })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, catalogIntent ? skuCandidates.length : 5);
  const prices = teaPriceEvidence.map((price) => {
    const { score, reasons } = priceMatch(price, normalized);
    return { ...price, score, matchReasons: reasons };
  }).filter((item) => item.score >= 12).sort((a, b) => b.score - a.score).slice(0, 3);
  const allowedKnowledgeTypes = knowledgeTypesByIntent[intent.intent];
  const knowledge = teaKnowledge.filter((document) => allowedKnowledgeTypes.includes(document.knowledgeType)).map((document) => {
    let score = 0;
    const reasons: string[] = [];
    const matches = matchTerms(normalized, document.keywords);
    if (matches.length) { score += Math.min(matches.length, 3) * 4; reasons.push(`命中知识关键词：${matches.slice(0, 2).join("、")}`); }
    if (intent.intent === "brewing_question" && document.knowledgeType === "brewing") { score += 12; reasons.push("匹配冲泡场景"); }
    if ((intent.intent === "gift_catalog" || intent.intent === "product_recommendation" || intent.intent === "product_fit") && document.knowledgeType === "recommendation") { score += 8; reasons.push("匹配推荐场景"); }
    if (document.knowledgeType === "sku" && skus.length) { score += 4; reasons.push("关联SKU资料"); }
    return { ...document, score, matchReasons: reasons };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
  return { products, skus, prices, knowledge };
}
