import type { IntentResult, TeaEntities, TeaIntent } from "@/types/tea";

const teaTypeRules = [
  ["绿茶", ["绿茶", "龙井", "茉莉"]],
  ["红茶", ["红茶", "桂花红茶"]],
  ["乌龙茶", ["乌龙", "岩茶"]],
  ["白茶", ["白茶", "白牡丹"]],
  ["普洱茶", ["普洱", "熟普", "陈皮"]],
] as const;

function includesAny(query: string, terms: readonly string[]) {
  return terms.some((term) => query.includes(term));
}

export function classifyTeaIntent(query: string): IntentResult {
  const normalized = query.trim().toLowerCase();
  const entities: TeaEntities = {};
  const budgetMatch = normalized.match(/(?:预算\s*)?[￥¥]?(\d{2,5})\s*元?/);
  if (budgetMatch) entities.budget = Number(budgetMatch[1]);

  if (includesAny(normalized, ["送礼", "礼物", "送长辈", "商务礼赠", "探望"])) entities.scene = "送礼";
  if (includesAny(normalized, ["长辈", "父母", "老人"])) entities.audience = "长辈";
  if (includesAny(normalized, ["清香", "清新", "清爽"])) entities.preference = "清香";
  if (includesAny(normalized, ["花香", "桂花", "茉莉"])) entities.preference = entities.preference ? `${entities.preference} / 花香` : "花香";

  const matchedTeaType = teaTypeRules.find(([, terms]) => includesAny(normalized, terms));
  if (matchedTeaType) entities.teaType = matchedTeaType[0];

  let intent: TeaIntent = "unknown";
  if (includesAny(normalized, ["怎么泡", "冲泡", "泡法", "水温", "出汤"])) {
    intent = "brewing_question";
  } else if (entities.scene === "送礼" || includesAny(normalized, ["礼盒", "送人"])) {
    intent = "gift_recommendation";
  } else if (includesAny(normalized, ["推荐", "有什么", "选什么", "适合我", "想买"])) {
    intent = "product_recommendation";
  } else if (includesAny(normalized, ["适合什么人", "规格", "价格", "口感", "是什么", "桂花红茶", "龙井", "白牡丹", "陈皮普洱", "岩韵乌龙", "茉莉绿茶"])) {
    intent = "product_question";
  }

  return { intent, entities };
}
