import { teaKnowledge } from "@/data/tea/knowledge";
import { teaPriceEvidence, teaProducts, teaSkus } from "@/data/tea/products";
import { classifyTeaIntent } from "@/lib/tea-intent";
import { retrieveTeaKnowledge } from "@/lib/tea-retrieval";
import type { PriceEvidence, RetrievedKnowledge, RetrievedProduct, RetrievedSku, TeaAnswer, TeaConversationContext, TeaEntities, TeaIntent, TeaProduct, TeaSku } from "@/types/tea";

const intentLabels: Record<TeaIntent, string> = {
  product_recommendation: "个性化推荐", product_question: "产品问答", product_fit: "口味适配", product_compare: "茶品对比", gift_catalog: "礼盒浏览", product_browse: "商品浏览", price_query: "价格查询", price_reverse_lookup: "价格反查", price_compare: "价格对比", price_extreme: "价格排序", quantity_price_calc: "数量与预算计算", brewing_question: "冲泡问答", brand_question: "品牌与产区问答", aftersales: "售后问答", unknown: "边界或未支持问题",
};

const productKnowledgeIds: Record<string, string> = { "mingqian-longjing": "KB002", "osmanthus-longjing": "KB003", "longjing-black-tea": "KB004", "osmanthus-black-tea": "KB005" };
const includesAny = (query: string, terms: string[]) => terms.some((term) => query.includes(term));
const unique = <T,>(items: T[]) => [...new Set(items)];
const uniqueById = <T extends { id: string },>(items: T[]) => Array.from(new Map(items.map((item) => [item.id, item])).values());

function entitySummary(entities: TeaEntities) {
  return [entities.budget !== undefined && `预算：¥${entities.budget}`, entities.scene && `场景：${entities.scene}`, entities.audience && `对象：${entities.audience}`, entities.preference && `偏好：${entities.preference}`, entities.requiredTeaTypes?.length && `限定茶类：${entities.requiredTeaTypes.join("/")}`, entities.packaging && `规格需求：${entities.packaging}`].filter(Boolean).join(" · ") || "未提取到明确偏好";
}

function sourceById(...ids: string[]): RetrievedKnowledge[] {
  return unique(ids).map((id) => teaKnowledge.find((document) => document.id === id)).filter((document): document is NonNullable<typeof document> => Boolean(document)).map((document) => ({ ...document, score: 100, matchReasons: ["回答依据"] }));
}

function productSources(productIds: string[], includeRecommendation = false, includeSku = false) {
  const productDocumentIds = productIds.map((id) => productKnowledgeIds[id]).filter(Boolean);
  if (includeSku) return sourceById(...productDocumentIds.slice(0, 1), ...(includeRecommendation ? ["KB010"] : []), "KB006").slice(0, 3);
  return sourceById(...productDocumentIds, ...(includeRecommendation ? ["KB010"] : [])).slice(0, 3);
}

function completedExecution(intent: TeaIntent, detail: string, knowledgeCount: number, skuCount: number) {
  return [
    { label: "接收用户问题", detail: "已收到本轮输入", status: "completed" as const },
    { label: "识别需求", detail: `${intentLabels[intent]} · ${detail}`, status: "completed" as const },
    { label: "检索项目资料", detail: `匹配 ${knowledgeCount} 条相关资料`, status: "completed" as const },
    { label: "匹配商品与规则", detail: skuCount ? `关联 ${skuCount} 项商品信息` : "已匹配对应业务规则", status: "completed" as const },
    { label: "生成回答", detail: "已完成（本地规则检索）", status: "completed" as const },
    { label: "返回参考资料", detail: "仅展示支持本次回答的资料", status: "completed" as const },
  ];
}

function priceForSku(sku: TeaSku) { return teaPriceEvidence.find((price) => sku.priceEvidenceIds?.includes(price.id)); }
function priceKind(price: PriceEvidence, amount = price.amount) {
  if (price.originalPrice === amount) return "划线价";
  return price.priceType === "new_customer" ? "新客价" : "售价";
}
function priceAmountText(price: PriceEvidence, amount = price.amount) { return `${priceKind(price, amount)} ¥${amount}`; }
function fullPriceText(price: PriceEvidence, displayedAmount = price.amount) {
  const originalPriceText = price.originalPrice && displayedAmount !== price.originalPrice ? `，划线价 ¥${price.originalPrice}` : "";
  const shippingText = price.shippingIncluded ? "，包邮" : "";
  return `${price.skuName}（${price.spec ? `${price.spec}，` : ""}${price.netContent}，${price.packaging}）：${priceAmountText(price, displayedAmount)}${originalPriceText}${shippingText}`;
}
function priceAnswer(price: PriceEvidence) {
  const originalPriceText = price.originalPrice ? `，划线价 ¥${price.originalPrice}` : "";
  const shippingText = price.shippingIncluded ? "，包邮" : "";
  if (price.priceType === "user_confirmed_business_rule") return `${price.skuName}为 ${price.spec ? `${price.spec}，` : ""}${price.netContent}，当前售价 ¥${price.amount}${originalPriceText}${shippingText}。该价格只对应此商品、组合与规格。`;
  return `${price.skuName}为 ${price.spec ? `${price.spec}，` : ""}${price.netContent}，资料中的销售页面价格为 ¥${price.amount}（新客价）${originalPriceText}。实际价格可能随活动变化，请以当前页面为准。`;
}
function priceMatchesAmount(price: PriceEvidence, amount: number) { return price.amount === amount || price.originalPrice === amount; }
function pricesForAmounts(amounts: number[]) { return teaPriceEvidence.filter((price) => amounts.some((amount) => priceMatchesAmount(price, amount))); }
function skuForPrice(price: PriceEvidence) { return teaSkus.find((sku) => sku.priceEvidenceIds?.includes(price.id)); }
function asRetrievedSku(sku: TeaSku, reason: string): RetrievedSku { return { ...sku, score: 100, matchReasons: [reason] }; }

function productsForSkus(skus: TeaSku[]): RetrievedProduct[] {
  const productIds = unique(skus.flatMap((sku) => sku.productIds));
  return productIds.map((id) => teaProducts.find((product) => product.id === id)).filter((product): product is TeaProduct => Boolean(product)).map((product) => ({ ...product, relatedSkus: teaSkus.filter((sku) => sku.productIds.includes(product.id)), score: 100, matchReasons: ["用于本轮推荐"] }));
}

function preferenceScore(sku: TeaSku, preference?: string) {
  if (!preference) return 0;
  let score = 0;
  if ((preference.includes("蜜香") || preference.includes("醇厚")) && sku.productIds.includes("longjing-black-tea")) score += 16;
  if (preference.includes("花香")) {
    if (sku.productIds.includes("osmanthus-longjing")) score += 12;
    if (sku.productIds.includes("osmanthus-black-tea")) score += 10;
  }
  if (preference.includes("鲜爽") || preference.includes("兰香") || preference.includes("栗香")) {
    if (sku.productIds.includes("mingqian-longjing")) score += 12;
    if (sku.productIds.includes("osmanthus-longjing")) score += 8;
  }
  return score;
}

function isHardExcluded(sku: TeaSku, entities: TeaEntities) {
  const products = sku.productIds.map((id) => teaProducts.find((product) => product.id === id)).filter((product): product is TeaProduct => Boolean(product));
  if (entities.excludedProductIds?.some((id) => sku.productIds.includes(id))) return true;
  if (entities.excludedTeaTypes?.some((category) => products.some((product) => product.category === category))) return true;
  if (entities.excludedFlavors?.some((term) => products.some((product) => product.flavor.some((flavor) => flavor.includes(term))))) return true;
  if (entities.excludedIngredients?.some((term) => products.some((product) => product.ingredients?.some((ingredient) => ingredient.includes(term))))) return true;
  return false;
}

function matchesHardInclusion(sku: TeaSku, entities: TeaEntities) {
  if (!entities.requiredTeaTypes?.length) return true;
  const products = sku.productIds.map((id) => teaProducts.find((product) => product.id === id)).filter((product): product is TeaProduct => Boolean(product));
  return products.length > 0 && products.every((product) => entities.requiredTeaTypes?.includes(product.category));
}

function selectRecommendationSkus(entities: TeaEntities) {
  let candidates = teaSkus.filter((sku) => Boolean(priceForSku(sku)));
  candidates = candidates.filter((sku) => !isHardExcluded(sku, entities));
  candidates = candidates.filter((sku) => matchesHardInclusion(sku, entities));
  if (entities.budget !== undefined) candidates = candidates.filter((sku) => (priceForSku(sku)?.amount ?? Infinity) <= entities.budget!);
  if (entities.scene === "送礼") candidates = candidates.filter((sku) => sku.packaging === "礼盒");
  if (entities.scene === "自饮") candidates = candidates.filter((sku) => sku.packaging !== "礼盒");
  if (entities.packaging === "试饮装") candidates = candidates.filter((sku) => sku.packaging === "试饮装");
  if (entities.packaging === "单盒 / 单罐装") candidates = candidates.filter((sku) => sku.packaging === "单盒 / 单罐装");
  if (entities.productIds?.length) candidates = candidates.filter((sku) => sku.productIds.some((id) => entities.productIds?.includes(id)));
  return candidates.sort((left, right) => preferenceScore(right, entities.preference) - preferenceScore(left, entities.preference) || (priceForSku(left)?.amount ?? Infinity) - (priceForSku(right)?.amount ?? Infinity)).slice(0, 3);
}

function hasEnoughRecommendationSignals(entities: TeaEntities) {
  return Boolean(entities.productIds?.length || entities.budget !== undefined || entities.requiredTeaTypes?.length || entities.excludedProductIds?.length || (entities.scene && entities.preference) || (entities.scene && entities.teaType));
}

function bestFitProduct(retrievalProducts: RetrievedProduct[], entities: TeaEntities) {
  if (entities.productIds?.length) return teaProducts.find((product) => product.id === entities.productIds?.[0]);
  return retrievalProducts[0];
}
function fitAnswer(product: TeaProduct) { return `${product.name}更适合${product.suitableFor.join("、")}。从口感看，它以${product.flavor.slice(0, 4).join("、")}为主；如果你在鲜爽、花香、蜜香或醇厚之间犹豫，也可以继续告诉我偏好，我会帮你对比具体规格。`; }

function priceReverseAnswer(amounts: number[]) {
  const groups = amounts.map((amount) => ({ amount, prices: teaPriceEvidence.filter((price) => priceMatchesAmount(price, amount)) })).filter((group) => group.prices.length);
  if (!groups.length) return undefined;
  const lines = groups.flatMap(({ amount, prices }) => [`¥${amount} 对应：`, ...prices.map((price) => `- ${fullPriceText(price, amount)}`)]);
  return lines.join("\n");
}

function priceComparisonAnswer(amounts: number[]) {
  const groups = amounts.map((amount) => ({ amount, prices: teaPriceEvidence.filter((price) => priceMatchesAmount(price, amount)) })).filter((group) => group.prices.length);
  if (groups.length < 2) return undefined;
  const lines = groups.flatMap(({ amount, prices }) => [`¥${amount}：`, ...prices.map((price) => `- ${fullPriceText(price, amount)}`)]);
  return `${lines.join("\n")}\n这些金额可能对应不同商品、规格和价格类型；对比时应以每条记录标注的售价、新客价或划线价为准，不能互相套用。`;
}

function priceScopeMatches(price: PriceEvidence, scope: TeaEntities["priceScope"]) {
  if (scope === "gift_box") return price.packaging === "礼盒";
  if (scope === "single_can") return price.packaging === "单罐";
  if (scope === "trial") return price.packaging === "试饮装";
  return true;
}

function extremePriceAnswer(entities: TeaEntities, isLowest: boolean) {
  const candidates = teaPriceEvidence.filter((price) => priceScopeMatches(price, entities.priceScope));
  if (!candidates.length) return undefined;
  const target = isLowest ? Math.min(...candidates.map((price) => price.amount)) : Math.max(...candidates.map((price) => price.amount));
  const matches = candidates.filter((price) => price.amount === target);
  const scopeLabel = entities.priceScope === "gift_box" ? "礼盒" : entities.priceScope === "single_can" ? "单罐" : entities.priceScope === "trial" ? "试饮装" : "商品";
  return `按当前可购买或展示的售价 / 新客价计算，${isLowest ? "最便宜" : "最贵"}的${scopeLabel}${matches.length > 1 ? "并列为" : "是"}：\n${matches.map((price) => `- ${fullPriceText(price)}`).join("\n")}`;
}

function quantityPriceAnswer(entities: TeaEntities) {
  if (entities.quantityPriceStatus === "missing_unit_price_or_product" || entities.unitPrice === undefined) return "可以帮你算，不过要先知道你说的是哪款商品。告诉我商品名称或单盒价格就行。";
  if (entities.quantityMode === "maximum") {
    if (entities.budget === undefined) return "可以帮你算，不过还需要知道你的预算金额。告诉我预算后，我会算出最多可以买几盒。";
    const maxCount = Math.floor(entities.budget / entities.unitPrice);
    return `按 ¥${entities.unitPrice} 单价计算，¥${entities.budget} 最多可以买 ${maxCount} 个 ¥${entities.unitPrice} 的商品，剩余 ¥${entities.budget - maxCount * entities.unitPrice}。`;
  }
  if (!entities.quantity) return "可以帮你算，不过还需要确认购买数量。";
  const total = entities.quantity * entities.unitPrice;
  if (entities.budget === undefined) return `按 ¥${entities.unitPrice} 单价计算，${entities.quantity} 盒共 ¥${total}。`;
  const maxCount = Math.floor(entities.budget / entities.unitPrice);
  if (total <= entities.budget) return `可以。按 ¥${entities.unitPrice} 单价计算，${entities.quantity} 盒共 ¥${total}，剩余 ¥${entities.budget - total}。该单价对应的商品需以具体组合、规格与包装为准。`;
  return `不能。按 ¥${entities.unitPrice} 单价计算，${entities.quantity} 盒共 ¥${total}，超过 ¥${entities.budget} 预算 ¥${total - entities.budget}。¥${entities.budget} 最多可以买 ${maxCount} 盒 ¥${entities.unitPrice} 的商品。`;
}

function productComparisonAnswer(productIds: string[], normalized: string) {
  const products = productIds.map((id) => teaProducts.find((product) => product.id === id)).filter((product): product is TeaProduct => Boolean(product));
  if (products.length < 2) return undefined;
  const focusesFreshness = includesAny(normalized, ["清爽", "鲜爽", "清香", "清新"]);
  const freshnessProduct = products.find((product) => product.flavor.some((flavor) => flavor.includes("鲜爽")));
  if (focusesFreshness && freshnessProduct) {
    const otherProduct = products.find((product) => product.id !== freshnessProduct.id);
    return `如果你更看重清爽感，我会更推荐${freshnessProduct.name}。它把${freshnessProduct.flavor.slice(0, 2).join("和")}放在前面，入口更鲜爽、轻快；${otherProduct?.name ?? "另一款"}则以${otherProduct?.flavor.slice(0, 2).join("和")}为主，整体更温润顺滑。想要日常喝得清新一些，选${freshnessProduct.name}会更合适。`;
  }
  const [firstProduct, secondProduct] = products;
  return `${firstProduct.name}和${secondProduct.name}都带有花香调，但风格并不相同：${firstProduct.name}属于${firstProduct.category}，偏${firstProduct.flavor.slice(0, 2).join("、")}，口感更轻快；${secondProduct.name}属于${secondProduct.category}，偏${secondProduct.flavor.slice(0, 2).join("、")}，喝起来更温润醇和。若你告诉我是自饮还是送礼，我可以再帮你落到具体规格。`;
}

function knownPricesInText(text: string) {
  return unique([...text.matchAll(/(?:[¥￥]\s*)?(\d+(?:\.\d+)?)(?:\s*(?:元|块))?/g)]
    .map((match) => Number(match[1]))
    .filter((amount) => teaPriceEvidence.some((price) => priceMatchesAmount(price, amount))));
}

function resolveReferencedUnitPrice(query: string, context?: TeaConversationContext) {
  const hasQuantity = /[一二两三四五六七八九十\d]+\s*(?:盒|份|件|个)|(?:能|可以|够)?买\s*几(?:个|盒|份|件)?/.test(query);
  if (!hasQuantity || knownPricesInText(query).length) return undefined;
  const previousQueries = [...(context?.priorUserQueries ?? [])].reverse();
  for (const previousQuery of previousQueries) {
    const prices = knownPricesInText(previousQuery);
    if (prices.length === 1) return prices[0];
  }
  const previousAnswers = [...(context?.priorAnswers ?? [])].reverse();
  for (const previousAnswer of previousAnswers) {
    const prices = unique((previousAnswer.recommendationSkus ?? []).flatMap((sku) => sku.priceEvidenceIds ?? []).map((id) => teaPriceEvidence.find((price) => price.id === id)?.amount).filter((amount): amount is number => amount !== undefined));
    if (prices.length === 1) return prices[0];
  }
  return undefined;
}

function splitCompoundQuery(query: string) {
  const parts = query.split(/[？?；;]/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [];
}

export function buildTeaAnswer(query: string, context?: TeaConversationContext, allowCompound = true): TeaAnswer {
  const compoundParts = allowCompound ? splitCompoundQuery(query) : [];
  if (compoundParts.length) {
    const answers = compoundParts.map((part) => ({ question: part, result: buildTeaAnswer(part, context, false) }));
    const recommendationSkus = uniqueById(answers.flatMap(({ result }) => result.recommendationSkus ?? []));
    return {
      answer: answers.map(({ question, result }) => `关于“${question}”：${result.answer}`).join("\n\n"),
      recommendations: uniqueById(answers.flatMap(({ result }) => result.recommendations)),
      recommendationSkus,
      sources: uniqueById(answers.flatMap(({ result }) => result.sources)),
      execution: completedExecution("product_question", `识别到 ${answers.length} 个子问题并分别回答`, uniqueById(answers.flatMap(({ result }) => result.sources)).length, recommendationSkus.length),
    };
  }

  const referenceUnitPrice = resolveReferencedUnitPrice(query, context);
  const normalized = query.toLowerCase();
  const intentResult = classifyTeaIntent(query, { referenceUnitPrice });
  const retrieval = retrieveTeaKnowledge(referenceUnitPrice === undefined ? query : `${query} ¥${referenceUnitPrice}`, intentResult);
  const entities = intentResult.entities;

  if (includesAny(normalized, ["治疗", "治失眠", "失眠", "减肥", "降血压", "医疗功效"])) return { answer: "我不能对茶品作治疗疾病、改善失眠或减肥等医疗功效承诺。当前资料也没有支持这类结论的依据；如涉及健康问题，请咨询专业人士。", recommendations: [], recommendationSkus: [], sources: sourceById("KB009"), execution: completedExecution("unknown", "医疗功效边界", 1, 0) };
  if (includesAny(normalized, ["其他客户", "客户订单", "订单信息", "手机号", "电话", "地址", "隐私", "修改订单", "取消订单", "真实物流", "支付"])) return { answer: "我不能查询、披露或修改其他客户的订单、电话、地址等隐私信息，也不连接真实订单、支付或物流系统。涉及个人订单或售后办理，请由人工客服在授权范围内处理。", recommendations: [], recommendationSkus: [], sources: sourceById("KB009"), execution: completedExecution("unknown", "隐私与真实系统边界", 1, 0) };
  if (includesAny(normalized, ["保质期", "18个月", "24个月"]) && includesAny(normalized, ["龙井红茶", "梅枞天红"])) return { answer: "现有资料中，龙井红茶 / 梅枞天红的保质期存在18个月和24个月两个版本。为避免误导，需要先确认具体 SKU、批次或实物标签；无法确认时应由人工客服协助核验。", recommendations: [], recommendationSkus: [], sources: sourceById("KB004", "KB009"), execution: completedExecution("product_question", "识别到保质期版本冲突", 2, 0) };

  if (intentResult.intent === "price_compare") {
    const answer = priceComparisonAnswer(entities.priceAmounts ?? []);
    if (answer) return { answer, recommendations: [], recommendationSkus: unique(pricesForAmounts(entities.priceAmounts ?? []).map(skuForPrice).filter((sku): sku is TeaSku => Boolean(sku))).map((sku) => asRetrievedSku(sku, "命中价格对比记录")), sources: sourceById("KB006"), execution: completedExecution("price_compare", "区分金额、规格与价格类型", 1, 0) };
  }
  if (intentResult.intent === "quantity_price_calc") {
    const answer = quantityPriceAnswer(entities);
    return { answer: referenceUnitPrice === undefined ? answer : `按上一轮提到的 ¥${referenceUnitPrice} 计算：${answer}`, recommendations: [], recommendationSkus: [], sources: sourceById("KB006"), execution: completedExecution("quantity_price_calc", entities.quantityPriceStatus === "missing_unit_price_or_product" ? "缺少商品或单盒价格" : entities.quantityMode === "maximum" ? `预算：¥${entities.budget} · 单价：¥${entities.unitPrice} · 计算最多可买数量${referenceUnitPrice === undefined ? "" : "（来自上轮上下文）"}` : `数量：${entities.quantity} · 单价：¥${entities.unitPrice}${referenceUnitPrice === undefined ? "" : "（来自上轮上下文）"}`, 1, 0) };
  }
  if (intentResult.intent === "price_extreme") {
    const answer = extremePriceAnswer(entities, normalized.includes("最便宜"));
    if (answer) return { answer, recommendations: [], recommendationSkus: [], sources: sourceById("KB006"), execution: completedExecution("price_extreme", `${normalized.includes("最便宜") ? "最低" : "最高"}价格 · ${entities.priceScope === "all" ? "全部商品" : entities.packaging}`, 1, 0) };
  }
  if (intentResult.intent === "price_reverse_lookup") {
    const answer = priceReverseAnswer(entities.priceAmounts ?? []);
    if (answer) return { answer, recommendations: [], recommendationSkus: unique(pricesForAmounts(entities.priceAmounts ?? []).map(skuForPrice).filter((sku): sku is TeaSku => Boolean(sku))).map((sku) => asRetrievedSku(sku, "命中价格反查记录")), sources: sourceById("KB006"), execution: completedExecution("price_reverse_lookup", `反查 ¥${(entities.priceAmounts ?? []).join(" / ¥")}`, 1, 0) };
  }
  if (intentResult.intent === "brand_question") return { answer: "不是。一叶春山的品牌宣传包含西湖产区及高端西湖龙井产品线，但不代表所有线上商品都是西湖龙井；品牌也存在钱塘产区产品。查询具体商品产区时，应以该商品当前参数页或实物标签为准。高端西湖龙井仅线下销售，当前价格和购买方式需进一步确认。", recommendations: [], recommendationSkus: [], sources: sourceById("KB001", "KB009"), execution: completedExecution("brand_question", "区分品牌宣传与具体商品资料", 2, 0) };
  if (intentResult.intent === "brewing_question") {
    const answer = entities.teaType === "红茶" || entities.teaType === "调味红茶" ? "红茶（龙井红茶/梅枞天红、桂花红茶）建议投茶3-5g，茶水比约1:20至1:30，水温95-100℃，建议冲泡5-7次。" : "绿茶（明前龙井、桂花龙井）建议投茶3-5g，茶水比约1:50，水温90-100℃，建议冲泡3-5次。";
    return { answer, recommendations: [], recommendationSkus: [], sources: sourceById("KB007"), execution: completedExecution("brewing_question", entities.teaType ? `茶类：${entities.teaType}` : "未指定茶类，返回分类冲泡规则", 1, 0) };
  }
  if (intentResult.intent === "price_query") {
    if (retrieval.prices.length) {
      const price = retrieval.prices[0];
      const secondPrice = retrieval.prices[1];
      if (secondPrice && secondPrice.score === price.score) return { answer: "当前问题未指定足够的商品范围。请补充具体茶品、组合、净含量或包装（例如60g单罐、150g双拼或250g礼盒），我不会把不同规格的价格互相套用。", recommendations: [], recommendationSkus: [], sources: sourceById("KB006", "KB011"), execution: completedExecution("price_query", "价格查询范围不足", 2, 0) };
      return { answer: priceAnswer(price), recommendations: [], recommendationSkus: [], sources: sourceById("KB006"), execution: completedExecution("price_query", `已匹配 ${price.skuName}`, 1, 1) };
    }
    if (includesAny(normalized, ["礼盒", "双拼", "双盒"])) return { answer: "请先确认具体礼盒的茶品、组合与规格（例如150g双拼或250g礼盒）。不同商品、组合、净含量与包装的价格不能互相套用，因此我不会直接返回¥298或¥418。", recommendations: [], recommendationSkus: [], sources: sourceById("KB006", "KB011"), execution: completedExecution("price_query", "礼盒价格查询范围不足", 2, 0) };
    return { answer: "当前资料没有该具体商品、规格和销售页面对应的可核验当期价格。我不会用其他商品的价格代替，建议以当前销售页面或人工客服确认。", recommendations: [], recommendationSkus: [], sources: sourceById("KB006", "KB009"), execution: completedExecution("price_query", "价格待进一步确认", 2, 0) };
  }
  if (includesAny(normalized, ["龙井红茶和梅枞天红", "梅枞天红和龙井红茶"])) return { answer: "不是两款不同的茶。梅枞天红是龙井红茶的品牌 / 商品别名；它们指向同一茶品资料，不会作为两件商品重复推荐。", recommendations: [], recommendationSkus: [], sources: sourceById("KB004"), execution: completedExecution("product_question", "别名映射：梅枞天红 → 龙井红茶", 1, 0) };
  if (intentResult.intent === "product_compare") {
    const answer = productComparisonAnswer(entities.productIds ?? [], normalized);
    if (answer) return { answer, recommendations: [], recommendationSkus: [], sources: productSources(entities.productIds ?? []), execution: completedExecution("product_compare", "对比茶类、风味与口感", (entities.productIds ?? []).length, 0) };
  }
  if (includesAny(normalized, ["梅枞天红"]) && includesAny(normalized, ["是什么", "哪款", "什么茶"])) return { answer: "梅枞天红是“龙井红茶”的品牌 / 商品别名。该茶品资料描述为蜜香浓郁，入口蜜甜醇厚、回甘较快。", recommendations: [], recommendationSkus: [], sources: sourceById("KB004"), execution: completedExecution("product_question", "别名映射：梅枞天红 → 龙井红茶", 1, 0) };
  if (intentResult.intent === "product_fit") {
    const product = bestFitProduct(retrieval.products, entities);
    if (product) return { answer: fitAnswer(product), recommendations: [], recommendationSkus: [], sources: productSources([product.id], true), execution: completedExecution("product_fit", `匹配茶品：${product.name}`, 2, 0) };
    return { answer: "可以。你更偏好鲜爽一点，还是花香、蜜香或醇厚一点？告诉我一个口味方向，我就能基于现有资料帮你缩小选择。", recommendations: [], recommendationSkus: [], sources: sourceById("KB010"), execution: completedExecution("product_fit", "口味偏好尚不明确", 1, 0) };
  }
  if (intentResult.intent === "gift_catalog" || intentResult.intent === "product_browse") {
    const isGiftCatalog = intentResult.intent === "gift_catalog";
    let catalog = teaSkus.filter((sku) => isGiftCatalog ? sku.packaging === "礼盒" : true);
    catalog = catalog.filter((sku) => !isHardExcluded(sku, entities) && matchesHardInclusion(sku, entities));
    if (entities.budget !== undefined) catalog = catalog.filter((sku) => (priceForSku(sku)?.amount ?? Infinity) <= entities.budget!);
    const catalogSkus = catalog.map((sku) => asRetrievedSku(sku, isGiftCatalog ? "当前可选礼盒" : "当前可选商品"));
    const answer = catalogSkus.length ? entities.budget !== undefined ? `在 ¥${entities.budget} 预算以内，当前资料中有 ${catalogSkus.length} 款价格已明确的${isGiftCatalog ? "礼盒" : "商品"}可供参考。你也可以再告诉我偏好鲜爽、花香、蜜香或醇厚，我会继续帮你缩小到1～2款。` : `当前资料中可识别的${isGiftCatalog ? "送礼礼盒" : "商品"}如下。价格待确认的商品会明确标注；如果告诉我预算和口味偏好，我可以继续帮你筛选。` : `当前资料中没有同时满足该预算与规格条件、且价格已明确的${isGiftCatalog ? "礼盒" : "商品"}。你可以放宽预算，或告诉我更偏好的茶类与口味。`;
    const sourceIds = isGiftCatalog ? ["KB006", "KB010"] : ["KB006"];
    return { answer, recommendations: productsForSkus(catalog), recommendationSkus: catalogSkus, sources: sourceById(...sourceIds), execution: completedExecution(intentResult.intent, entities.budget !== undefined ? `按 ¥${entities.budget} 预算筛选` : "展示当前可识别商品", sourceIds.length, catalogSkus.length) };
  }
  const exactSku = retrieval.skus.find((sku) => sku.score >= 16);
  if (exactSku) return { answer: `${exactSku.name}：规格为 ${exactSku.spec}，${exactSku.netContent}，包装类型为${exactSku.packaging}。`, recommendations: [], recommendationSkus: [], sources: sourceById("KB006"), execution: completedExecution("product_question", `匹配商品：${exactSku.name}`, 1, 1) };
  if (intentResult.intent === "product_recommendation") {
    if (!hasEnoughRecommendationSignals(entities)) return { answer: "可以。主要是自己喝还是送礼？口味更喜欢鲜爽一点，还是花香 / 醇厚一点？", recommendations: [], recommendationSkus: [], sources: sourceById("KB010"), execution: completedExecution("product_recommendation", "推荐信息仍需补充", 1, 0) };
    const selectedSkus = selectRecommendationSkus(entities);
    if (!selectedSkus.length) return { answer: "按你提供的条件，当前已录入且价格明确的正式商品里暂时没有合适选项。我不会用不符合茶类、偏好或价格条件的商品替代；你可以调整预算或补充想要的规格。", recommendations: [], recommendationSkus: [], sources: sourceById("KB006", "KB010"), execution: completedExecution("product_recommendation", "未找到同时满足硬条件的商品", 2, 0) };
    const selectedProductIds = unique(selectedSkus.flatMap((sku) => sku.productIds));
    return { answer: `结合${entitySummary(entities)}，以下商品与已知偏好和预算更匹配。每项价格均只对应其列出的组合、规格与包装。`, recommendations: productsForSkus(selectedSkus), recommendationSkus: selectedSkus.map((sku) => asRetrievedSku(sku, "符合本轮硬条件、预算与口味偏好")), sources: productSources(selectedProductIds, true, true), execution: completedExecution("product_recommendation", entitySummary(entities), Math.min(3, selectedProductIds.length + 1), selectedSkus.length) };
  }
  if (intentResult.intent === "aftersales") return { answer: "储存建议低温、避光、密封、干燥并避免异味。发货、退款或拆封后的售后规则可能因具体商品和页面口径不同而变化；涉及具体订单或售后处理时，建议由人工客服确认。", recommendations: [], recommendationSkus: [], sources: sourceById("KB008", "KB009"), execution: completedExecution("aftersales", "匹配售后与边界资料", 2, 0) };
  if (retrieval.products.length) {
    const product = retrieval.products[0];
    return { answer: `${product.name}：${product.description}`, recommendations: [], recommendationSkus: [], sources: productSources([product.id]), execution: completedExecution("product_question", `匹配茶品：${product.name}`, 1, product.relatedSkus.length) };
  }
  return { answer: "当前项目资料中没有可以支持该问题的有效信息。我不会根据缺失资料补充答案；你可以询问已收录茶品、商品规格、冲泡、价格、储存与售后边界。", recommendations: [], recommendationSkus: [], sources: [], execution: [{ label: "接收用户问题", detail: "已收到本轮输入", status: "completed" }, { label: "检索项目资料", detail: "无有效来源", status: "empty" }, { label: "生成回答", detail: "按知识库边界返回", status: "completed" }] };
}
