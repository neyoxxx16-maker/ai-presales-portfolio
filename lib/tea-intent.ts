import type { IntentResult, TeaEntities, TeaIntent } from "@/types/tea";

const teaTypeRules = [
  ["红茶", ["龙井红茶", "梅枞天红"]],
  ["调味红茶", ["桂花红茶"]],
  ["调味绿茶", ["桂花龙井"]],
  ["绿茶", ["明前龙井", "绿茶"]],
] as const;

function includesAny(query: string, terms: readonly string[]) {
  return terms.some((term) => query.includes(term));
}

export function classifyTeaIntent(query: string): IntentResult {
  const normalized = query.trim().toLowerCase();
  const entities: TeaEntities = {};
  const budgetMatch = normalized.match(/(?:预算\s*)?[￥¥]?(\d{2,5})\s*元?/);
  if (budgetMatch) entities.budget = Number(budgetMatch[1]);
  if (includesAny(normalized, ["送礼", "礼物", "送人", "探望", "商务礼赠"])) entities.scene = "送礼";
  if (includesAny(normalized, ["自饮", "自己喝", "日常喝"])) entities.scene = "自饮";
  if (includesAny(normalized, ["长辈", "父母", "老人"])) entities.audience = "长辈";

  const preferences = [
    ["鲜爽", ["鲜爽", "清爽"]], ["花香", ["花香", "桂花"]], ["蜜香", ["蜜香", "蜜甜"]], ["醇厚", ["醇厚"]], ["栗香", ["栗香"]],
  ].filter(([, terms]) => includesAny(normalized, terms as string[])).map(([label]) => label);
  if (preferences.length) entities.preference = preferences.join(" / ");
  if (includesAny(normalized, ["试饮", "试喝"])) entities.packaging = "试饮装";
  if (includesAny(normalized, ["礼盒", "双拼", "双盒"])) entities.packaging = "礼盒";
  if (includesAny(normalized, ["单罐", "单盒", "单装"])) entities.packaging = "单盒 / 单罐装";

  const teaType = teaTypeRules.find(([, terms]) => includesAny(normalized, terms));
  if (teaType) entities.teaType = teaType[0];

  let intent: TeaIntent = "unknown";
  if (includesAny(normalized, ["怎么泡", "冲泡", "泡法", "水温", "茶水比", "投茶量"])) intent = "brewing_question";
  else if (entities.scene === "送礼" || entities.packaging === "礼盒") intent = "gift_recommendation";
  else if (includesAny(normalized, ["推荐", "选什么", "适合我", "想买"])) intent = "product_recommendation";
  else if (includesAny(normalized, ["价格", "多少钱", "规格", "多少克", "净含量", "口感", "配料", "保质期", "产区", "是什么", "明前龙井", "桂花龙井", "龙井红茶", "梅枞天红", "桂花红茶"])) intent = "product_question";
  return { intent, entities };
}
