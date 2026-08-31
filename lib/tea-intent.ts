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

const productIdRules = [
  ["mingqian-longjing", ["明前龙井"]],
  ["osmanthus-longjing", ["桂花龙井"]],
  ["longjing-black-tea", ["龙井红茶", "梅枞天红"]],
  ["osmanthus-black-tea", ["桂花红茶"]],
] as const;

export function classifyTeaIntent(query: string): IntentResult {
  const normalized = query.trim().toLowerCase();
  const entities: TeaEntities = {};
  const budgetMatch = normalized.match(/(?:预算\s*)?[￥¥]?(\d{2,5})\s*元?/);
  if (budgetMatch) entities.budget = Number(budgetMatch[1]);
  if (includesAny(normalized, ["送礼", "礼物", "送人", "想送", "送给", "探望", "商务礼赠", "送朋友", "送同事", "送客户"])) entities.scene = "送礼";
  if (includesAny(normalized, ["自饮", "自己喝", "日常喝"])) entities.scene = "自饮";
  if (includesAny(normalized, ["长辈", "父母", "老人"])) entities.audience = "长辈";
  else if (includesAny(normalized, ["朋友", "同事", "客户"])) entities.audience = "朋友 / 同事";

  const preferences = [
    ["鲜爽", ["鲜爽", "清爽", "清香", "清新"]], ["兰香", ["兰香"]], ["花香", ["花香", "桂花"]], ["蜜香", ["蜜香", "蜜甜"]], ["醇厚", ["醇厚", "厚重"]], ["栗香", ["栗香"]],
  ].filter(([, terms]) => includesAny(normalized, terms as string[])).map(([label]) => label);
  if (preferences.length) entities.preference = preferences.join(" / ");
  if (includesAny(normalized, ["试饮", "试喝"])) entities.packaging = "试饮装";
  if (includesAny(normalized, ["礼盒", "双拼", "双盒"])) entities.packaging = "礼盒";
  if (includesAny(normalized, ["单罐", "单盒", "单装"])) entities.packaging = "单盒 / 单罐装";

  const teaType = teaTypeRules.find(([, terms]) => includesAny(normalized, terms));
  if (teaType) entities.teaType = teaType[0];
  const productIds = productIdRules.filter(([, terms]) => includesAny(normalized, terms)).map(([id]) => id);
  if (productIds.length) entities.productIds = productIds;

  let intent: TeaIntent = "unknown";
  if (includesAny(normalized, ["怎么泡", "冲泡", "泡法", "水温", "茶水比", "投茶量"])) intent = "brewing_question";
  else if (includesAny(normalized, ["多少钱", "价格", "价钱"])) intent = "price_query";
  else if (includesAny(normalized, ["所有茶都是西湖", "西湖龙井", "钱塘产区", "高端西湖龙井", "网上买吗", "线上买吗"])) intent = "brand_question";
  else if (includesAny(normalized, ["发货", "碎茶", "退货", "退款", "售后", "储存", "保存"])) intent = "aftersales";
  else if (includesAny(normalized, ["有哪些", "都有什么", "礼盒有哪些", "给我看看送礼的", "有什么可以选", "你们卖什么", "有什么产品", "有哪些茶"]) || (normalized.includes("有什么") && !normalized.includes("有什么推荐") && includesAny(normalized, ["礼盒", "双拼", "双盒", "产品", "茶"]))) intent = entities.scene === "送礼" || entities.packaging === "礼盒" ? "gift_catalog" : "product_browse";
  else if (includesAny(normalized, ["适合什么人", "适合谁", "什么人喝", "我适合喝吗", "适合哪种口味", "谁会喜欢", "什么人比较喜欢", "适合送什么人", "适合什么"]) || (Boolean(entities.preference) && !entities.budget && !entities.scene && !normalized.includes("推荐"))) intent = "product_fit";
  else if (includesAny(normalized, ["推荐", "选什么", "适合我", "想买"]) || (Boolean(entities.preference) && Boolean(entities.budget || entities.scene))) intent = "product_recommendation";
  else if (includesAny(normalized, ["价格", "多少钱", "规格", "多少克", "净含量", "口感", "配料", "保质期", "产区", "是什么", "明前龙井", "桂花龙井", "龙井红茶", "梅枞天红", "桂花红茶"])) intent = "product_question";
  return { intent, entities };
}
