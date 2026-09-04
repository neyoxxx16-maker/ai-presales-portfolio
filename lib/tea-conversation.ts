import { teaPriceEvidence, teaProducts, teaSkus } from "@/data/tea/products";
import { classifyTeaIntent } from "@/lib/tea-intent";
import { buildStructuredSkuAnswer, buildTeaAnswer } from "@/lib/tea-response";
import type { PendingQuantityDialog, TeaAnswer, TeaConstraintState, TeaConversationContext, TeaConversationState, TeaSku, TeaTurnResult } from "@/types/tea";

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
  return /^(?:另外|换个问题|不算了)/.test(query.trim())
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
  return Boolean(entities.excludedProductIds?.length || entities.excludedTeaTypes?.length || entities.excludedFlavors?.length || entities.excludedIngredients?.length || entities.requiredTeaTypes?.length || entities.includedTeaTypes?.length || entities.preference || entities.budget !== undefined || entities.exactWeightGrams !== undefined || entities.sizePreference || entities.packageType || entities.requiredPackaging || entities.excludedPackaging?.length || entities.scene);
}

/** A new selection question starts a fresh constraint set.  Only explicit discourse
 * continuations are permitted to consume the prior turn's slots. */
function isConstraintContinuation(query: string) {
  const normalized = query.replace(/\s/g, "");
  return /^(?:那|这些|其中|改|换|预算提高|预算改|提高到|不限制|算了|不要|别|再|同样|现在只看)/.test(normalized)
    || /^\d+(?:元|块)?(?:以内|以下)$/.test(normalized)
    || /^(?:预算|改|换|提高到)\D{0,4}[￥¥]?\d+(?:元|块)?$/.test(normalized)
    || /^(?:想尝鲜|想试试|想要小一点|想要大一点|小包装一点|大包装一点|自己喝|送(?:人|朋友|长辈|同事))$/.test(normalized);
}

function constraintPatch(query: string): Partial<TeaConstraintState> {
  const normalized = query.replace(/\s/g, "");
  const entities = classifyTeaIntent(query).entities;
  const patch: Partial<TeaConstraintState> = {};
  // CLEAR must deliberately leave an own property with undefined so merge removes it.
  if (/(?:不限制|不限|随意).*(?:规格|克重|重量|大小|包装)|(?:规格|克重|重量).*(?:不限制|不限)/.test(normalized)) {
    patch.exactWeight = undefined; patch.sizePreference = undefined;
    if (/(?:包装)/.test(normalized)) { patch.packageType = undefined; patch.excludePackageType = undefined; }
  } else if (entities.exactWeightGrams !== undefined) patch.exactWeight = entities.exactWeightGrams;
  if (entities.sizePreference) patch.sizePreference = entities.sizePreference;
  const revisedBudget = normalized.match(/(?:预算(?:提高到|改成|调整为)?|提高到|改(?:成)?|换(?:成)?)\s*[￥¥]?(\d+(?:\.\d+)?)(?:元|块)?/);
  if (entities.budget !== undefined) patch.budgetMax = entities.budget;
  else if (revisedBudget) patch.budgetMax = Number(revisedBudget[1]);
  if (entities.scene === "送礼") patch.scenario = "gifting";
  if (entities.scene === "自饮") patch.scenario = "self";
  if (entities.scene === "试饮") patch.scenario = "trial";
  if (entities.audience) patch.recipient = entities.audience;

  const rejectsRed = /(?:不要|不喝|不想喝|不想要|排除|别)(?:喝|要)?红茶/.test(normalized);
  const rejectsGreen = /(?:不要|不喝|不想喝|不想要|排除|别)(?:喝|要)?绿茶/.test(normalized);
  const wantsRed = normalized.includes("红茶") && !rejectsRed;
  const wantsGreen = normalized.includes("绿茶") && !rejectsGreen;
  if (wantsRed) { patch.teaType = "红茶"; patch.excludeTeaType = undefined; }
  if (wantsGreen) { patch.teaType = "绿茶"; patch.excludeTeaType = undefined; }
  if (rejectsRed) { patch.excludeTeaType = "红茶"; patch.teaType = undefined; }
  if (rejectsGreen) { patch.excludeTeaType = "绿茶"; patch.teaType = undefined; }

  const rejectsOsmanthus = /(?:不要|不喜欢|不想|排除|别).*桂花/.test(normalized);
  if (rejectsOsmanthus) { patch.excludeFlavor = "桂花"; patch.includeFlavor = undefined; }
  else if (entities.includedProductIds?.some((id) => id.startsWith("osmanthus-")) || (normalized.includes("桂花") && !normalized.includes("桂花龙井") && !normalized.includes("桂花红茶"))) { patch.includeFlavor = "桂花"; patch.excludeFlavor = undefined; }

  const rejectsGift = /(?:不要|不要求|不用|不需要|别).*礼盒/.test(normalized);
  if (rejectsGift) { patch.excludePackageType = "礼盒"; patch.packageType = undefined; }
  else if (normalized.includes("礼盒")) { patch.packageType = "礼盒"; patch.excludePackageType = undefined; }
  else if (entities.packageType) { patch.packageType = entities.packageType; patch.excludePackageType = undefined; }
  if (entities.excludedIngredients?.includes("龙井")) { patch.excludeLongjingIngredient = true; patch.ingredientExclusion = "龙井"; }
  if (entities.recommendationLimit) patch.requestedCount = entities.recommendationLimit;
  if (patch.scenario === "self") patch.recipient = undefined;
  return patch;
}

function mergeConstraints(previous: TeaConstraintState | undefined, patch: Partial<TeaConstraintState>) {
  const merged: TeaConstraintState = { ...(previous ?? {}) };
  for (const key of Object.keys(patch) as Array<keyof TeaConstraintState>) {
    const value = patch[key];
    if (value === undefined) delete merged[key]; else (merged[key] as never) = value as never;
  }
  // Defensive normalization: opposite values never coexist after SET / REPLACE / NEGATE.
  if (merged.includeFlavor && merged.excludeFlavor === merged.includeFlavor) delete merged.includeFlavor;
  if (merged.packageType === merged.excludePackageType) delete merged.packageType;
  if (merged.teaType && merged.excludeTeaType === merged.teaType) delete merged.teaType;
  return merged;
}

function constraintQuery(constraints: TeaConstraintState) {
  const terms = [
    constraints.budgetMax !== undefined && `预算${constraints.budgetMax}元`,
    constraints.exactWeight !== undefined && `${constraints.exactWeight}g`,
    constraints.sizePreference === "small" && "小一点",
    constraints.sizePreference === "large" && "大一点",
    constraints.teaType,
    constraints.includeFlavor,
    constraints.excludeTeaType && `不要${constraints.excludeTeaType}`,
    constraints.excludeFlavor && `不要${constraints.excludeFlavor}`,
    constraints.packageType,
    constraints.excludePackageType && `不要${constraints.excludePackageType}`,
    constraints.scenario === "gifting" && "送人",
    constraints.scenario === "self" && "自己喝",
    constraints.scenario === "trial" && "试饮",
    constraints.recipient,
    constraints.excludeLongjingIngredient && "不要龙井原料",
    constraints.requestedCount && `推荐${constraints.requestedCount}款`,
  ].filter(Boolean);
  return `${terms.join("，")}，推荐什么`;
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
  const patch = constraintPatch(query);
  const carriesConstraints = isConstraintContinuation(query) && Boolean(freshState.constraints);
  const constraints = mergeConstraints(carriesConstraints ? freshState.constraints : undefined, patch);
  if (freshState.lastRecommendationQuery && carriesConstraints && isRecommendationConstraintUpdate(query)) {
    const answer = buildTeaAnswer(constraintQuery(constraints), context);
    const explanation = /不要龙井/.test(query) && constraints.teaType === "红茶" && !constraints.excludeLongjingIngredient
      ? "如果你说的“不要龙井”是指不想喝龙井绿茶，可以选择红茶；店内红茶使用龙井茶相关原料制作，但成品茶类属于红茶。"
      : "";
    if (explanation) answer.answer = `${answer.answer}\n${explanation}`;
    return { answer, state: { constraints, lastRecommendationQuery: constraintQuery(constraints), lastCandidateSkuIds: answer.recommendationSkus?.map((sku) => sku.id) }, intent: "product_recommendation" };
  }
  if (freshState.lastCandidateSkuIds?.length && /哪个/.test(query) && /送(?:人|礼|给)/.test(query)) {
    const answer = candidateGiftFollowUp(freshState);
    if (answer) return { answer, state: freshState, intent: "product_fit" };
  }

  const intent = classifyTeaIntent(query).intent;
  const answer = buildTeaAnswer(query, context);
  if (/不要龙井/.test(query) && constraints.teaType === "红茶" && !constraints.excludeLongjingIngredient) {
    answer.answer = `${answer.answer}\n如果你说的“不要龙井”是指不想喝龙井绿茶，可以选择红茶；店内红茶使用龙井茶相关原料制作，但成品茶类属于红茶。`;
  }
  const pendingDialog = createPendingQuantityDialog(query, answer);
  return {
    answer,
    state: pendingDialog ? { pendingDialog, constraints } : {
      constraints,
      lastRecommendationQuery: intent === "product_recommendation" ? query : undefined,
      lastCandidateSkuIds: answer.recommendationSkus?.map((sku) => sku.id),
    },
    intent,
  };
}
