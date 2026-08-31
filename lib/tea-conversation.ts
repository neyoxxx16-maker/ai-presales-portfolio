import { teaPriceEvidence, teaProducts, teaSkus } from "@/data/tea/products";
import { classifyTeaIntent } from "@/lib/tea-intent";
import { buildStructuredSkuAnswer, buildTeaAnswer } from "@/lib/tea-response";
import type { PendingQuantityDialog, TeaAnswer, TeaConversationContext, TeaConversationState, TeaSku, TeaTurnResult } from "@/types/tea";

const unique = <T,>(items: T[]) => [...new Set(items)];

function priceForSku(sku: TeaSku) {
  return teaPriceEvidence.find((price) => sku.priceEvidenceIds?.includes(price.id));
}

function knownPricesInText(query: string) {
  return unique([...query.matchAll(/(?:[¥￥]\s*)?(\d+(?:\.\d+)?)(?:\s*(?:元|块))?/g)]
    .map((match) => Number(match[1]))
    .filter((amount) => teaPriceEvidence.some((price) => price.amount === amount || price.originalPrice === amount)));
}

function isExplicitNewIntent(query: string) {
  const intent = classifyTeaIntent(query).intent;
  return /^(?:算了|另外|换个问题|不算了)/.test(query.trim())
    || ["brewing_question", "brand_question", "aftersales", "gift_catalog"].includes(intent)
    || /(?:是什么|适合什么人|保质期|怎么泡|冲泡|售后|退货|退款)/.test(query);
}

function isCandidateBrowseRequest(query: string) {
  const normalized = query.replace(/\s/g, "").replace(/[？?。！!]+$/, "");
  return /^(?:有哪些|有什么|给我看看|有哪些可选)(?:商品|产品|茶|可选商品|可选产品)?$/.test(normalized)
    || /^(?:给我看看|看看)(?:有哪些|有什么)(?:商品|产品|茶|可选商品|可选产品)?$/.test(normalized);
}

function directProductSkus(productId: string) {
  return teaSkus.filter((sku) => sku.productIds.length === 1 && sku.productIds.includes(productId) && priceForSku(sku));
}

function matchesSkuSpecification(query: string, sku: TeaSku) {
  const normalized = query.toLowerCase().replace(/\s/g, "");
  return [sku.name, sku.spec, sku.netContent, sku.packaging]
    .map((value) => value.toLowerCase().replace(/\s/g, ""))
    .some((value) => value.length >= 2 && normalized.includes(value));
}

function specificationInText(query: string) {
  const match = query.toLowerCase().replace(/\s/g, "").match(/(\d+(?:\.\d+)?)(?:g|克)/);
  return match ? `${match[1]}g` : undefined;
}

function joinProductNames(productIds: string[]) {
  const names = unique(productIds.map((id) => teaProducts.find((product) => product.id === id)?.name).filter((name): name is string => Boolean(name)));
  if (names.length < 2) return names.join("");
  if (names.length === 2) return names.join("和");
  return `${names.slice(0, -1).join("、")}和${names[names.length - 1]}`;
}

function quantityClarificationAnswer(productId?: string, candidates: TeaSku[] = []): TeaAnswer {
  if (!productId || !candidates.length) return buildTeaAnswer("500能买两盒吗？");
  const product = teaProducts.find((item) => item.id === productId);
  const options = candidates.map((sku) => `${sku.name}（${sku.spec}，${sku.netContent}，¥${priceForSku(sku)?.amount}）`).join(" 和 ");
  const sourceAnswer = buildTeaAnswer(product?.name ?? "商品规格");
  return {
    ...sourceAnswer,
    answer: `${product?.name ?? "这款茶"}有不同规格。目前已录入的有 ${options}。你想算哪一种？`,
    recommendations: [],
    recommendationSkus: [],
  };
}

function quantityProductClarificationAnswer(specification: string, candidates: TeaSku[]): TeaAnswer {
  const products = joinProductNames(candidates.flatMap((sku) => sku.productIds));
  const sourceAnswer = buildTeaAnswer(`${specification} 单罐`);
  return {
    ...sourceAnswer,
    answer: `目前 ${specification} 单罐有${products}，你想要哪一款？`,
    recommendations: [],
    recommendationSkus: [],
  };
}

function completedQuantityAnswer(dialog: PendingQuantityDialog, selectedSku?: TeaSku) {
  const { budget, quantity, unitPrice } = dialog.slots;
  const calculation = buildTeaAnswer(`预算${budget}元，能买${quantity}盒${unitPrice}的吗？`);
  if (!selectedSku) return calculation;
  const unitLabel = selectedSku.name.includes("单罐") ? "罐" : "盒";
  return {
    ...calculation,
    answer: `如果你指${selectedSku.name}（${selectedSku.netContent}），${calculation.answer.replaceAll(`${quantity} 盒`, `${quantity} ${unitLabel}`)}`,
  };
}

function createPendingQuantityDialog(query: string, answer: TeaAnswer): PendingQuantityDialog | undefined {
  const classified = classifyTeaIntent(query);
  const stillMissingUnitPrice = answer.execution.some((step) => step.detail?.includes("缺少商品或单盒价格"));
  if (classified.intent !== "quantity_price_calc" || classified.entities.quantityPriceStatus !== "missing_unit_price_or_product" || !stillMissingUnitPrice) return undefined;
  return {
    intent: "quantity_price_calc",
    slots: { budget: classified.entities.budget, quantity: classified.entities.quantity },
    missingSlots: ["product_or_unit_price"],
  };
}

function continueQuantityDialog(query: string, state: TeaConversationState): TeaTurnResult | undefined {
  const dialog = state.pendingDialog;
  if (!dialog) return undefined;
  if (isCandidateBrowseRequest(query)) {
    return { answer: buildTeaAnswer(query), state: { ...state, pendingDialog: dialog }, intent: classifyTeaIntent(query).intent };
  }
  if (isExplicitNewIntent(query)) return undefined;
  const classified = classifyTeaIntent(query);
  const directPrice = knownPricesInText(query);
  const slots = {
    ...dialog.slots,
    budget: classified.entities.budget ?? dialog.slots.budget,
    quantity: classified.entities.quantity ?? dialog.slots.quantity,
    specification: specificationInText(query) ?? dialog.slots.specification,
    unitPrice: classified.entities.unitPrice ?? (directPrice.length === 1 ? directPrice[0] : dialog.slots.unitPrice),
  };
  const productId = classified.entities.productIds?.[0] ?? dialog.slots.productId;
  let candidates = (dialog.slots.candidateSkuIds ?? []).map((id) => teaSkus.find((sku) => sku.id === id)).filter((sku): sku is TeaSku => Boolean(sku));
  if (classified.entities.productIds?.length) candidates = directProductSkus(classified.entities.productIds[0]);
  if (slots.specification) candidates = (candidates.length ? candidates : teaSkus).filter((sku) => matchesSkuSpecification(slots.specification!, sku));
  const selectedSku = candidates.length === 1 ? candidates[0] : undefined;

  if (selectedSku) slots.unitPrice = priceForSku(selectedSku)?.amount;
  if (slots.unitPrice !== undefined && slots.quantity !== undefined && slots.budget !== undefined) {
    const completed = completedQuantityAnswer({ intent: "quantity_price_calc", slots, missingSlots: [] }, selectedSku);
    return { answer: completed, state: { lastCandidateSkuIds: completed.recommendationSkus?.map((sku) => sku.id) }, intent: "quantity_price_calc" };
  }
  if (productId && candidates.length > 1) {
    const nextDialog: PendingQuantityDialog = { intent: "quantity_price_calc", slots: { ...slots, productId, candidateSkuIds: candidates.map((sku) => sku.id) }, missingSlots: ["sku_specification"] };
    return { answer: quantityClarificationAnswer(productId, candidates), state: { pendingDialog: nextDialog }, intent: "quantity_price_calc" };
  }
  if (slots.specification && candidates.length > 1) {
    const nextDialog: PendingQuantityDialog = { intent: "quantity_price_calc", slots: { ...slots, candidateSkuIds: candidates.map((sku) => sku.id) }, missingSlots: ["product_or_unit_price"] };
    return { answer: quantityProductClarificationAnswer(slots.specification, candidates), state: { pendingDialog: nextDialog }, intent: "quantity_price_calc" };
  }
  const answer = buildTeaAnswer("500能买两盒吗？");
  return { answer, state: { pendingDialog: { intent: "quantity_price_calc", slots: { ...slots, productId }, missingSlots: ["product_or_unit_price"] } }, intent: "quantity_price_calc" };
}

function isRecommendationConstraintUpdate(query: string) {
  const entities = classifyTeaIntent(query).entities;
  return Boolean(entities.excludedProductIds?.length || entities.excludedTeaTypes?.length || entities.excludedFlavors?.length || entities.requiredTeaTypes?.length || entities.preference || entities.budget !== undefined);
}

function candidateGiftFollowUp(state: TeaConversationState): TeaAnswer | undefined {
  const candidates = (state.lastCandidateSkuIds ?? []).map((id) => teaSkus.find((sku) => sku.id === id)).filter((sku): sku is TeaSku => Boolean(sku));
  if (!candidates.length) return undefined;
  const sourceAnswer = buildTeaAnswer("有哪些礼盒？");
  return {
    ...sourceAnswer,
    answer: `上一轮对应的候选是${candidates.map((sku) => sku.name).join("、")}，它们都是礼盒。若送给偏好鲜爽和桂花香的人，可优先看含桂花龙井的款；若偏好红茶暖香，可优先看含桂花红茶的款。你也可以告诉我送礼对象和口味，我会在这组候选里继续缩小范围。`,
    recommendations: [],
    recommendationSkus: [],
  };
}

function recentCandidateSkus(state: TeaConversationState, context?: TeaConversationContext) {
  const stateCandidates = (state.lastCandidateSkuIds ?? []).map((id) => teaSkus.find((sku) => sku.id === id)).filter((sku): sku is TeaSku => Boolean(sku));
  if (stateCandidates.length) return stateCandidates;
  const priorCandidates = [...(context?.priorAnswers ?? [])].reverse().find((answer) => answer.recommendationSkus?.length)?.recommendationSkus ?? [];
  return priorCandidates.map((sku) => teaSkus.find((candidate) => candidate.id === sku.id)).filter((sku): sku is TeaSku => Boolean(sku));
}

function ordinalSkuFollowUp(query: string, state: TeaConversationState, context?: TeaConversationContext): TeaTurnResult | undefined {
  const match = query.replace(/\s/g, "").match(/第([一二三四五六七八九十1-9])(?:种|款|个|盒)?/);
  if (!match) return undefined;
  const ordinalMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const position = /^\d$/.test(match[1]) ? Number(match[1]) : ordinalMap[match[1]];
  const candidates = recentCandidateSkus(state, context);
  const sku = candidates[position - 1];
  if (!sku) return undefined;
  return { answer: buildStructuredSkuAnswer(sku, `上下文指代：第${match[1]}种候选`), state: { ...state, lastCandidateSkuIds: candidates.map((candidate) => candidate.id) }, intent: "product_question" };
}

export function processTeaTurn(query: string, state: TeaConversationState = {}, context?: TeaConversationContext): TeaTurnResult {
  const continued = continueQuantityDialog(query, state);
  if (continued) return continued;
  const ordinalFollowUp = ordinalSkuFollowUp(query, state, context);
  if (ordinalFollowUp) return ordinalFollowUp;

  const freshState = isExplicitNewIntent(query) ? {} : state;
  if (freshState.lastRecommendationQuery && isRecommendationConstraintUpdate(query)) {
    const combinedQuery = `${freshState.lastRecommendationQuery.replace(/[？?；;。]+$/, "")}，${query}`;
    const answer = buildTeaAnswer(combinedQuery, context);
    return { answer, state: { lastRecommendationQuery: combinedQuery, lastCandidateSkuIds: answer.recommendationSkus?.map((sku) => sku.id) }, intent: "product_recommendation" };
  }
  if (freshState.lastCandidateSkuIds?.length && /哪个/.test(query) && /送(?:人|礼|给)/.test(query)) {
    const answer = candidateGiftFollowUp(freshState);
    if (answer) return { answer, state: freshState, intent: "product_fit" };
  }

  const intent = classifyTeaIntent(query).intent;
  const answer = buildTeaAnswer(query, context);
  const pendingDialog = createPendingQuantityDialog(query, answer);
  return {
    answer,
    state: pendingDialog ? { pendingDialog } : {
      lastRecommendationQuery: intent === "product_recommendation" ? query : undefined,
      lastCandidateSkuIds: answer.recommendationSkus?.map((sku) => sku.id),
    },
    intent,
  };
}
