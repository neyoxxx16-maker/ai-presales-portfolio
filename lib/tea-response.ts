import { teaKnowledge } from "@/data/tea/knowledge";
import { teaPriceEvidence } from "@/data/tea/products";
import { classifyTeaIntent } from "@/lib/tea-intent";
import { retrieveTeaKnowledge } from "@/lib/tea-retrieval";
import type { TeaAnswer, TeaEntities } from "@/types/tea";

const intentLabels = { product_recommendation: "商品推荐", product_question: "产品问答", brewing_question: "冲泡问答", gift_recommendation: "礼赠推荐", unknown: "边界或未支持问题" } as const;
const includesAny = (query: string, terms: string[]) => terms.some((term) => query.includes(term));

function entitySummary(entities: TeaEntities) {
  return [entities.scene && `场景：${entities.scene}`, entities.preference && `偏好：${entities.preference}`, entities.teaType && `茶类：${entities.teaType}`, entities.packaging && `规格需求：${entities.packaging}`].filter(Boolean).join(" · ") || "未提取到可用于推荐的偏好";
}

function sourceById(...ids: string[]) {
  return teaKnowledge.filter((document) => ids.includes(document.id)).map((document) => ({ ...document, score: 100, matchReasons: ["回答依据"] }));
}

function completedExecution(intent: keyof typeof intentLabels, detail: string, knowledgeCount: number, skuCount: number) {
  return [
    { label: "接收用户问题", detail: "已收到本轮输入", status: "completed" as const },
    { label: "识别需求", detail: `${intentLabels[intent]} · ${detail}`, status: "completed" as const },
    { label: "检索项目资料知识库", detail: `命中 ${knowledgeCount} 条知识资料`, status: "completed" as const },
    { label: "匹配茶品与商品", detail: `关联 ${skuCount} 个商品 / 价格证据`, status: "completed" as const },
    { label: "生成可追溯结果", detail: "已完成（本地规则检索）", status: "completed" as const },
  ];
}

function priceAnswer(price: typeof teaPriceEvidence[number]) {
  const specText = price.spec ? `${price.spec}，` : "";
  const originalPriceText = price.originalPrice ? `，划线价为 ¥${price.originalPrice}` : "";
  const shippingText = price.shippingIncluded ? "，包邮" : "";
  if (price.priceType === "user_confirmed_business_rule") {
    return `根据用户本人确认的业务口径，${price.skuName}（${specText}${price.netContent}）当前售价为 ¥${price.amount}${originalPriceText}${shippingText}。该价格只对应此商品、组合与规格。`;
  }
  return `${price.skuName}（${specText}${price.netContent}）在对应微信小店截图中的新客价为 ¥${price.amount}${originalPriceText}。该证据只适用于此商品与规格；价格和促销可能变化，请以当前销售页面为准。`;
}

export function buildTeaAnswer(query: string): TeaAnswer {
  const normalized = query.toLowerCase();
  const intentResult = classifyTeaIntent(query);
  const retrieval = retrieveTeaKnowledge(query, intentResult);
  const baseDetail = entitySummary(intentResult.entities);

  if (includesAny(normalized, ["治疗", "治失眠", "失眠", "减肥", "降血压", "医疗功效"])) {
    return { answer: "我不能对茶品作治疗疾病、改善失眠或减肥等医疗功效承诺。当前项目资料也没有支持这类结论的依据；如涉及健康问题，请咨询专业人士。", recommendations: [], sources: sourceById("KB009"), execution: completedExecution("unknown", "医疗功效边界", 1, 0) };
  }
  if (includesAny(normalized, ["其他客户", "客户订单", "订单信息", "手机号", "电话", "地址", "隐私", "修改订单", "取消订单", "真实物流", "支付"])) {
    return { answer: "我不能查询、披露或修改其他客户的订单、电话、地址等隐私信息，也不连接真实订单、支付或物流系统。涉及个人订单或售后办理，请由人工客服在授权范围内处理。", recommendations: [], sources: sourceById("KB009"), execution: completedExecution("unknown", "隐私与真实系统边界", 1, 0) };
  }

  const asksPrice = includesAny(normalized, ["多少钱", "价格", "价钱"]);
  if (asksPrice && retrieval.prices.length) {
    const price = retrieval.prices[0];
    const secondPrice = retrieval.prices[1];
    if (secondPrice && secondPrice.score === price.score) {
      return { answer: "当前问题未指定足够的商品范围。请补充具体茶品、组合、净含量或包装（例如60g单罐、150g双拼或250g礼盒），我不会把不同规格的价格互相套用。", recommendations: [], sources: sourceById("KB006", "KB011"), execution: completedExecution("product_question", "价格查询范围不足", 2, 0) };
    }
    return { answer: priceAnswer(price), recommendations: [], sources: sourceById("KB006"), execution: completedExecution("product_question", `命中价格证据：${price.skuName} ${price.netContent}`, 1, 1) };
  }
  if (asksPrice && includesAny(normalized, ["礼盒", "双拼", "双盒"])) {
    return { answer: "请先确认具体礼盒的茶品、组合与规格（例如150g双拼或250g礼盒）。不同商品、组合、净含量与包装的价格不能互相套用，因此我不会直接返回¥298或¥418。", recommendations: [], sources: sourceById("KB006", "KB011"), execution: completedExecution("product_question", "礼盒价格查询范围不足", 2, 0) };
  }
  if (asksPrice) {
    return { answer: "当前资料没有该具体商品、规格和销售页面对应的可核验当期价格。我不会用其他 SKU 的截图价代替，建议以当前销售页面或人工客服确认。", recommendations: [], sources: sourceById("KB006", "KB009"), execution: completedExecution("product_question", "价格待核验", 2, 0) };
  }

  if (includesAny(normalized, ["保质期", "18个月", "24个月"]) && includesAny(normalized, ["龙井红茶", "梅枞天红"])) {
    return { answer: "现有资料中，龙井红茶 / 梅枞天红的保质期存在18个月和24个月两个版本。为避免误导，需要先确认具体 SKU、批次或实物标签；无法确认时应由人工客服协助核验。", recommendations: [], sources: sourceById("KB004", "KB009"), execution: completedExecution("product_question", "识别到保质期版本冲突", 2, 0) };
  }
  if (includesAny(normalized, ["梅枞天红"])) {
    return { answer: "梅枞天红是“龙井红茶”的品牌 / 商品别名。该茶品资料描述为干茶乌润紧细、蜜香浓郁，入口蜜甜醇厚、回甘较快。", recommendations: [], sources: sourceById("KB004"), execution: completedExecution("product_question", "别名映射：梅枞天红 → 龙井红茶", 1, 0) };
  }
  if (includesAny(normalized, ["西湖龙井", "所有茶都是西湖", "钱塘产区"])) {
    return { answer: "不是。一叶春山的品牌宣传包含西湖产区及高端西湖龙井产品线，但不代表所有线上商品都是西湖龙井；品牌也存在钱塘产区产品。查询具体商品产区时，应以该商品当前参数页或实物标签为准。高端西湖龙井仅线下销售，当前价格和购买方式需人工确认。", recommendations: [], sources: sourceById("KB001", "KB009"), execution: completedExecution("product_question", "区分品牌宣传、线上SKU与高端线下产品", 2, 0) };
  }

  if (intentResult.intent === "brewing_question") {
    const teaType = intentResult.entities.teaType;
    const answer = teaType === "红茶" || teaType === "调味红茶"
      ? "红茶（龙井红茶/梅枞天红、桂花红茶）建议投茶3-5g，茶水比约1:20至1:30，水温95-100℃，建议冲泡5-7次。"
      : "绿茶（明前龙井、桂花龙井）建议投茶3-5g，茶水比约1:50，水温90-100℃，建议冲泡3-5次。";
    return { answer, recommendations: [], sources: sourceById("KB007"), execution: completedExecution("brewing_question", teaType ? `茶类：${teaType}` : "未指定茶类，返回分类冲泡规则", 1, 0) };
  }

  const exactSku = retrieval.skus.find((sku) => sku.score >= 16);
  if (exactSku) {
    const price = teaPriceEvidence.find((item) => exactSku.priceEvidenceIds?.includes(item.id));
    const priceText = price ? ` ${priceAnswer(price)}` : " 当前价格：待当前销售页面或人工核验。";
    return { answer: `${exactSku.name}：规格为 ${exactSku.spec}，${exactSku.netContent}，包装类型为${exactSku.packaging}。${priceText}`, recommendations: [], sources: sourceById("KB006"), execution: completedExecution("product_question", `匹配SKU：${exactSku.name}`, 1, 1) };
  }

  if (intentResult.intent === "product_recommendation" || intentResult.intent === "gift_recommendation") {
    const signalCount = [intentResult.entities.scene, intentResult.entities.teaType, intentResult.entities.preference, intentResult.entities.packaging].filter(Boolean).length;
    if (signalCount < 2) {
      return { answer: "为了避免在资料不足时直接推荐，请再补充至少两项信息：自饮或送礼、绿茶或红茶偏好、鲜爽/花香/蜜香/醇厚偏好、试饮装/单装/礼盒需求。", recommendations: [], sources: sourceById("KB010"), execution: completedExecution(intentResult.intent, "推荐信息不足，等待补充", 1, 0) };
    }
    if (retrieval.products.length) {
      return { answer: `根据已识别的${baseDetail}，以下建议仅依据项目资料整理的茶品风味与SKU关系，不包含未核验价格、库存、产区或折扣信息。`, recommendations: retrieval.products.slice(0, 2), sources: sourceById("KB010", ...retrieval.products.slice(0, 2).map((product) => product.id === "mingqian-longjing" ? "KB002" : product.id === "osmanthus-longjing" ? "KB003" : product.id === "longjing-black-tea" ? "KB004" : "KB005")), execution: completedExecution(intentResult.intent, baseDetail, 3, retrieval.products.reduce((count, product) => count + product.relatedSkus.length, 0)) };
    }
  }

  if (retrieval.products.length) {
    const product = retrieval.products[0];
    return { answer: `${product.name}：${product.description}`, recommendations: [], sources: retrieval.knowledge.slice(0, 3), execution: completedExecution("product_question", `匹配茶品：${product.name}`, retrieval.knowledge.length, product.relatedSkus.length) };
  }
  return { answer: "当前项目资料中没有可以支持该问题的有效信息。我不会根据缺失资料补充答案；你可以询问已收录茶品、SKU规格、冲泡、价格证据、储存与售后边界。", recommendations: [], sources: [], execution: [{ label: "接收用户问题", detail: "已收到本轮输入", status: "completed" }, { label: "检索项目资料知识库", detail: "无有效来源", status: "empty" }, { label: "生成回答", detail: "按知识库边界返回", status: "completed" }] };
}
