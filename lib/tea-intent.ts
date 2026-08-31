import type { IntentResult, TeaCategory, TeaEntities, TeaIntent } from "@/types/tea";

const productIdRules = [
  ["mingqian-longjing", ["明前龙井"]],
  ["osmanthus-longjing", ["桂花龙井"]],
  ["longjing-black-tea", ["龙井红茶", "梅枞天红"]],
  ["osmanthus-black-tea", ["桂花红茶"]],
] as const;

const preferenceRules = [
  ["鲜爽", ["鲜爽", "清爽", "清香", "清新"]],
  ["兰香", ["兰香"]],
  ["花香", ["花香", "桂花"]],
  ["蜜香", ["蜜香", "蜜甜"]],
  ["醇厚", ["醇厚", "厚重"]],
  ["栗香", ["栗香"]],
] as const;

const negativePrefixes = ["不喜欢", "不要", "不想要", "不喝", "不考虑", "不想喝", "排除"];
const chineseNumbers: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function includesAny(query: string, terms: readonly string[]) {
  return terms.some((term) => query.includes(term));
}

function hasPositiveTerm(query: string, term: string) {
  let offset = query.indexOf(term);
  while (offset >= 0) {
    const context = query.slice(Math.max(0, offset - 8), offset);
    if (!negativePrefixes.some((prefix) => context.includes(prefix))) return true;
    offset = query.indexOf(term, offset + term.length);
  }
  return false;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function parsePriceAmounts(query: string) {
  const amounts = [...query.matchAll(/(?:[¥￥]\s*)?(\d+(?:\.\d+)?)(?:\s*(?:元|块))?/g)]
    .map((match) => Number(match[1]))
    .filter((amount) => amount > 0);
  return unique(amounts);
}

function parseQuantity(value?: string) {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  return chineseNumbers[value];
}

function parsePriceScope(query: string) {
  if (includesAny(query, ["礼盒", "双拼", "双盒"])) return "gift_box" as const;
  if (includesAny(query, ["单罐", "单盒", "单装"])) return "single_can" as const;
  if (includesAny(query, ["试饮", "试喝"])) return "trial" as const;
  return "all" as const;
}

function teaGroupForTerm(term: string): TeaCategory[] | undefined {
  if (term.includes("桂花龙井")) return ["调味绿茶"];
  if (term.includes("桂花红茶")) return ["调味红茶"];
  if (term.includes("明前龙井") || term === "绿茶") return ["绿茶", "调味绿茶"];
  if (term.includes("龙井红茶") || term.includes("梅枞天红") || term === "红茶") return ["红茶", "调味红茶"];
  return undefined;
}

function populateHardFilters(query: string, entities: TeaEntities) {
  const excludedProductIds: string[] = [];
  const excludedTeaTypes: TeaCategory[] = [];
  const excludedFlavors: string[] = [];
  const excludedIngredients: string[] = [];
  const hasNegative = (term: string) => negativePrefixes.some((prefix) => query.includes(`${prefix}${term}`));

  if (hasNegative("桂花")) {
    excludedProductIds.push("osmanthus-longjing", "osmanthus-black-tea");
    excludedFlavors.push("桂花");
    excludedIngredients.push("桂花");
  }
  if (hasNegative("红茶")) {
    excludedProductIds.push("longjing-black-tea", "osmanthus-black-tea");
    excludedTeaTypes.push("红茶", "调味红茶");
  }
  if (hasNegative("绿茶")) {
    excludedProductIds.push("mingqian-longjing", "osmanthus-longjing");
    excludedTeaTypes.push("绿茶", "调味绿茶");
  }
  for (const [productId, terms] of productIdRules) {
    if (terms.some((term) => hasNegative(term))) excludedProductIds.push(productId);
  }

  if (excludedProductIds.length) entities.excludedProductIds = unique(excludedProductIds);
  if (excludedTeaTypes.length) entities.excludedTeaTypes = unique(excludedTeaTypes);
  if (excludedFlavors.length) entities.excludedFlavors = unique(excludedFlavors);
  if (excludedIngredients.length) entities.excludedIngredients = unique(excludedIngredients);

  const requiredMatch = query.match(/(?:只喝|只要|只想喝)\s*(桂花龙井|桂花红茶|明前龙井|龙井红茶|梅枞天红|绿茶|红茶)/);
  if (requiredMatch) {
    const group = teaGroupForTerm(requiredMatch[1]);
    if (group) entities.requiredTeaTypes = group;
  }
}

export function classifyTeaIntent(query: string, options?: { referenceUnitPrice?: number }): IntentResult {
  const normalized = query.trim().toLowerCase();
  const entities: TeaEntities = {};
  const budgetMatch = normalized.match(/(?:预算|只有|有)\s*[￥¥]?(\d{2,5}(?:\.\d+)?)(?:\s*(?:元|块))?/) ?? normalized.match(/[￥¥]?(\d{2,5}(?:\.\d+)?)(?:\s*(?:元|块))?\s*(?:以内|以下)/) ?? normalized.match(/[￥¥]?(\d{2,5}(?:\.\d+)?)\s*(?:元|块)/) ?? normalized.match(/[￥¥]?(\d{2,5}(?:\.\d+)?)(?:\s*(?:元|块))?\s*(?:能|可以|够)?买/) ?? normalized.match(/[￥¥]?(\d{2,5}(?:\.\d+)?)(?:\s*(?:元|块))?\s*预算/) ?? normalized.match(/够\s*[￥¥]?(\d{2,5}(?:\.\d+)?)/);
  if (budgetMatch) entities.budget = Number(budgetMatch[1]);
  const amounts = parsePriceAmounts(normalized);
  if (amounts.length) entities.priceAmounts = amounts;
  if (includesAny(normalized, ["送礼", "礼物", "送人", "想送", "送给", "探望", "商务礼赠", "送朋友", "送同事", "送客户"])) entities.scene = "送礼";
  if (includesAny(normalized, ["自饮", "自己喝", "日常喝"])) entities.scene = "自饮";
  if (includesAny(normalized, ["长辈", "父母", "老人"])) entities.audience = "长辈";
  else if (includesAny(normalized, ["朋友", "同事", "客户"])) entities.audience = "朋友 / 同事";

  populateHardFilters(normalized, entities);
  const preferences = preferenceRules
    .filter(([, terms]) => (terms as readonly string[]).some((term) => hasPositiveTerm(normalized, term)))
    .map(([label]) => label);
  if (preferences.length) entities.preference = preferences.join(" / ");

  entities.priceScope = parsePriceScope(normalized);
  if (entities.priceScope === "trial") entities.packaging = "试饮装";
  if (entities.priceScope === "gift_box") entities.packaging = "礼盒";
  if (entities.priceScope === "single_can") entities.packaging = "单盒 / 单罐装";

  const productIds = productIdRules.filter(([, terms]) => includesAny(normalized, terms)).map(([id]) => id);
  if (productIds.length) entities.productIds = unique(productIds);
  const teaType = entities.productIds?.includes("osmanthus-longjing") ? "调味绿茶"
    : entities.productIds?.includes("osmanthus-black-tea") ? "调味红茶"
      : entities.productIds?.includes("longjing-black-tea") ? "红茶"
        : entities.productIds?.includes("mingqian-longjing") ? "绿茶"
          : normalized.includes("红茶") ? "红茶"
            : normalized.includes("绿茶") ? "绿茶" : undefined;
  if (teaType) entities.teaType = teaType;

  const quantityMatch = normalized.match(/([一二两三四五六七八九十\d]+)\s*(?:盒|份|件|个)/);
  const maximumQuantityRequested = /(?:能|可以|够)?买\s*几(?:个|盒|份|件)?|可以买\s*多少|最多\s*买/.test(normalized);
  const hasQuantityExpression = Boolean(quantityMatch) || maximumQuantityRequested;
  const hasQuantityPurchaseRelation = hasQuantityExpression && (includesAny(normalized, ["能买", "可以买", "够买", "买得了", "买得了吗", "够吗", "够不够", "多少钱", "要多少钱", "花多少钱", "买几个", "买多少"]) || /够\s*[￥¥]?\d/.test(normalized));
  if (quantityMatch) {
    entities.quantity = parseQuantity(quantityMatch[1]);
    entities.quantityMode = "exact";
    const numberAfterQuantity = normalized.slice((quantityMatch.index ?? 0) + quantityMatch[0].length).match(/(\d+(?:\.\d+)?)/);
    const numberBeforeQuantity = normalized.slice(0, quantityMatch.index ?? 0).match(/(\d+(?:\.\d+)?)(?:\s*(?:元|块))?(?:的)?(?:买)?\s*$/);
    const pricePerItem = normalized.match(/(?:[￥¥]\s*)?(\d+(?:\.\d+)?)(?:\s*(?:元|块))?\s*(?:一)?(?:盒|份|件|个)/);
    entities.unitPrice = numberAfterQuantity ? Number(numberAfterQuantity[1]) : numberBeforeQuantity ? Number(numberBeforeQuantity[1]) : pricePerItem ? Number(pricePerItem[1]) : undefined;
    if (entities.unitPrice === undefined && amounts.length >= 2) entities.unitPrice = amounts.find((amount) => amount !== entities.budget);
    if (entities.unitPrice === undefined && options?.referenceUnitPrice !== undefined) entities.unitPrice = options.referenceUnitPrice;
  }
  if (maximumQuantityRequested) {
    entities.quantityMode = "maximum";
    const pricePerItem = normalized.match(/(?:[￥¥]\s*)?(\d+(?:\.\d+)?)(?:\s*(?:元|块))?\s*(?:一)?(?:盒|份|件|个)/);
    entities.unitPrice = pricePerItem ? Number(pricePerItem[1]) : amounts.find((amount) => amount !== entities.budget);
    if (entities.unitPrice === undefined && options?.referenceUnitPrice !== undefined) entities.unitPrice = options.referenceUnitPrice;
  }
  if (hasQuantityPurchaseRelation) {
    entities.quantityPriceStatus = entities.unitPrice === undefined ? "missing_unit_price_or_product" : entities.quantityMode === "maximum" && entities.budget === undefined ? "missing_budget" : "complete";
  }

  const hasComparePhrase = includesAny(normalized, ["有什么区别", "区别", "哪个", "更", "比较", "对比"]);
  const hasPriceLookupPhrase = includesAny(normalized, ["哪款", "哪个商品", "什么商品", "对应哪些产品", "对应什么产品", "这个价格", "的是哪个"]);
  const isExtreme = includesAny(normalized, ["最贵", "最便宜"]);
  const hasCatalogExistenceQuestion = /^(?:(?:你们|这里|店里)?\s*.+?(?:有吗|有没有|有没)|(?:你们|这里|店里)?\s*有\s*(?!哪些|什么|什么产品|哪些产品).+?吗)[？?。！!]*$/.test(normalized);
  let intent: TeaIntent = "unknown";
  if (amounts.length >= 2 && hasComparePhrase && !hasQuantityPurchaseRelation) intent = "price_compare";
  else if (hasQuantityPurchaseRelation) intent = "quantity_price_calc";
  else if (isExtreme) intent = "price_extreme";
  else if (amounts.length && hasPriceLookupPhrase) intent = "price_reverse_lookup";
  else if (includesAny(normalized, ["多少钱", "价格", "价钱"])) intent = "price_query";
  else if ((entities.productIds?.length ?? 0) >= 2 && hasComparePhrase) intent = "product_compare";
  else if (includesAny(normalized, ["怎么泡", "冲泡", "泡法", "水温", "茶水比", "投茶量"])) intent = "brewing_question";
  else if (includesAny(normalized, ["所有茶都是西湖", "西湖龙井", "钱塘产区", "高端西湖龙井", "网上买吗", "线上买吗"])) intent = "brand_question";
  else if (includesAny(normalized, ["发货", "碎茶", "退货", "退款", "售后", "储存", "保存"])) intent = "aftersales";
  else if (hasCatalogExistenceQuestion) intent = "product_existence";
  else if (includesAny(normalized, ["有哪些", "都有什么", "礼盒有哪些", "给我看看送礼的", "有什么可以选", "你们卖什么", "有什么产品", "有哪些茶"]) || (normalized.includes("有什么") && !normalized.includes("有什么推荐") && includesAny(normalized, ["礼盒", "双拼", "双盒", "产品", "茶"]))) intent = entities.scene === "送礼" || entities.packaging === "礼盒" ? "gift_catalog" : "product_browse";
  else if (includesAny(normalized, ["适合什么人", "适合谁", "什么人喝", "我适合喝吗", "适合哪种口味", "谁会喜欢", "什么人比较喜欢", "适合送什么人", "适合什么"]) || (Boolean(entities.preference) && !entities.budget && !entities.scene && !normalized.includes("推荐"))) intent = "product_fit";
  else if (includesAny(normalized, ["推荐", "选什么", "适合我", "想买", "能买什么"]) || Boolean(entities.budget) || Boolean(entities.requiredTeaTypes?.length) || Boolean(entities.excludedProductIds?.length) || (Boolean(entities.preference) && Boolean(entities.budget || entities.scene))) intent = "product_recommendation";
  else if (includesAny(normalized, ["规格", "多少克", "净含量", "口感", "配料", "保质期", "产区", "是什么", "明前龙井", "桂花龙井", "龙井红茶", "梅枞天红", "桂花红茶"])) intent = "product_question";
  return { intent, entities };
}
