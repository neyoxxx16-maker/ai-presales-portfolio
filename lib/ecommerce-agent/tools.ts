import { teaPriceEvidence, teaProducts, teaSkus } from "@/data/tea/products";
import type { EcommerceAgentResult, EcommerceProductFacts, EcommerceTaskType, RiskIssue, RiskReview, ValidationIssue, ValidationResult } from "@/types/ecommerce-agent";

const knownPackagings = ["礼盒", "试饮装", "单罐", "单盒"];
const unique = <T,>(items: T[]) => [...new Set(items)];

export function getProductFacts(skuId: string): EcommerceProductFacts | undefined {
  const sku = teaSkus.find((item) => item.id === skuId);
  if (!sku) return undefined;
  const products = sku.productIds.map((id) => teaProducts.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const priceEvidence = teaPriceEvidence.find((item) => sku.priceEvidenceIds?.includes(item.id));
  return {
    skuId: sku.id,
    skuName: sku.name,
    productNames: products.map((product) => product.name),
    specification: sku.spec,
    netContent: sku.netContent,
    packaging: sku.packaging,
    price: priceEvidence ? {
      amount: priceEvidence.amount,
      label: priceEvidence.priceType === "new_customer" ? "新客价" : "售价",
      ...(priceEvidence.originalPrice ? { originalPrice: priceEvidence.originalPrice } : {}),
      ...(priceEvidence.shippingIncluded ? { shippingIncluded: true } : {}),
    } : undefined,
    supportedSellingPoints: unique(products.flatMap((product) => product.flavor).concat(products.flatMap((product) => product.suitableFor))),
    unavailableFields: ["产区", "库存", "销量", "优惠活动", "物流时效", "功效宣称"],
  };
}

function normalized(value: string) { return value.replace(/\s/g, "").toLowerCase(); }
function matchesKnownWeight(content: string) { return unique(content.match(/\d+(?:\.\d+)?\s*g/gi) ?? []).map(normalized); }
function expectedWeights(facts: EcommerceProductFacts) { return matchesKnownWeight(`${facts.specification} ${facts.netContent}`); }
function expectedPackagingTerms(facts: EcommerceProductFacts) {
  if (facts.packaging.includes("单盒") || facts.packaging.includes("单罐")) return ["单罐", "单盒"];
  return knownPackagings.filter((term) => facts.packaging.includes(term));
}

export function validateProductClaims(content: string, facts: EcommerceProductFacts): ValidationResult {
  const issues: ValidationIssue[] = [];
  const allProductNames = teaProducts.map((product) => product.name);
  const conflictingProducts = allProductNames.filter((name) => content.includes(name) && !facts.productNames.includes(name));
  if (conflictingProducts.length) issues.push({ field: "商品名", severity: "error", message: `文案提及“${conflictingProducts.join("、")}”，但所选商品资料并不包含该茶品。` });

  const allSkuIds = teaSkus.map((sku) => sku.id);
  const conflictingSkuIds = allSkuIds.filter((id) => content.includes(id) && id !== facts.skuId);
  if (conflictingSkuIds.length) issues.push({ field: "SKU", severity: "error", message: `文案包含其他 SKU：${conflictingSkuIds.join("、")}。` });

  const expectedWeightValues = expectedWeights(facts);
  const invalidWeights = matchesKnownWeight(content).filter((weight) => !expectedWeightValues.includes(weight));
  if (invalidWeights.length) issues.push({ field: "规格 / 净含量", severity: "error", message: `文案写有 ${invalidWeights.join("、")}，但已确认规格为 ${facts.specification}／${facts.netContent}。` });

  const packagingTerms = knownPackagings.filter((term) => content.includes(term));
  const invalidPackaging = packagingTerms.filter((term) => !expectedPackagingTerms(facts).includes(term));
  if (invalidPackaging.length) issues.push({ field: "包装", severity: "error", message: `文案描述为 ${invalidPackaging.join("、")}，与已确认包装“${facts.packaging}”不一致。` });

  const prices = unique([...content.matchAll(/(?:¥|￥)\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])));
  const allowedPrices = facts.price ? [facts.price.amount, facts.price.originalPrice].filter((value): value is number => typeof value === "number") : [];
  const invalidPrices = prices.filter((price) => !allowedPrices.includes(price));
  if (invalidPrices.length) issues.push({ field: "价格", severity: "error", message: `文案写有 ¥${invalidPrices.join("、¥")}，但当前商品资料未提供该价格。` });

  return { passed: issues.length === 0, issues, checkedFields: ["SKU", "商品名", "规格 / 净含量", "包装", "价格"] };
}

const riskRules: Array<{ pattern: RegExp; category: RiskIssue["category"]; severity: RiskIssue["severity"]; message: string }> = [
  { pattern: /100%|绝对|唯一|顶级|最佳|保证|永久|必然|立刻见效/iu, category: "绝对化表达", severity: "attention", message: "含有绝对化或无法证明的营销表达，建议改为可被资料支持的描述。" },
  { pattern: /治疗|治愈|降血糖|抗癌|保健功效|药效/iu, category: "商业合规", severity: "block", message: "含有医疗或功效承诺，不能作为商品文案使用。" },
  { pattern: /产自|核心产区|有机认证|零农残|无农残|销量|全网|回购率|限时|库存充足|当日发货|包邮/iu, category: "无依据声明", severity: "attention", message: "包含当前知识库未提供或未允许直接使用的商业事实，需要补充依据或删除。" },
];

export function scanContentRisk(content: string, validation: ValidationResult): RiskReview {
  const issues: RiskIssue[] = [];
  for (const rule of riskRules) if (rule.pattern.test(content)) issues.push({ category: rule.category, severity: rule.severity, message: rule.message });
  if (!validation.passed) issues.push({ category: "参数冲突", severity: "block", message: "参数一致性检查发现错误，当前内容不能进入采用状态。" });
  const level = issues.some((issue) => issue.severity === "block") ? "block" : issues.length ? "attention" : "low";
  const suggestions = issues.length ? unique(issues.map((issue) => issue.category === "参数冲突" ? "请以商品事实卡中的规格、包装和价格修订文案。" : "删除或改写该表述，并补充可验证的资料依据。")) : ["未发现明显风险；仍需由业务人员确认后采用。"];
  return { level, issues, suggestions };
}

export function finalizeContent(content: string, facts: EcommerceProductFacts, taskType: EcommerceTaskType) {
  const validation = validateProductClaims(content, facts);
  const riskReview = scanContentRisk(content, validation);
  const status: EcommerceAgentResult["status"] = riskReview.level === "block" ? "blocked" : riskReview.level === "attention" ? "needs_revision" : "ready_for_review";
  return { taskType, product: facts, generatedContent: content.trim(), verifiedFacts: [
    `SKU：${facts.skuName}`,
    `规格：${facts.specification}`,
    `净含量：${facts.netContent}`,
    `包装：${facts.packaging}`,
    ...(facts.price ? [`${facts.price.label}：¥${facts.price.amount}${facts.price.originalPrice ? `（划线价 ¥${facts.price.originalPrice}）` : ""}`] : []),
  ], validation, riskReview, status };
}
