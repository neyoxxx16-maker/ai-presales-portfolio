import { classifyTeaIntent } from "@/lib/tea-intent";
import { retrieveTeaKnowledge } from "@/lib/tea-retrieval";
import type { TeaAnswer } from "@/types/tea";

const intentLabels = {
  product_recommendation: "商品推荐",
  product_question: "产品问答",
  brewing_question: "冲泡问答",
  gift_recommendation: "礼赠推荐",
  unknown: "未识别为可支持场景",
} as const;

function entitySummary(entities: ReturnType<typeof classifyTeaIntent>["entities"]) {
  const items = [
    entities.scene && `场景：${entities.scene}`,
    entities.audience && `对象：${entities.audience}`,
    entities.budget && `预算：${entities.budget} 元`,
    entities.preference && `偏好：${entities.preference}`,
    entities.teaType && `茶类：${entities.teaType}`,
  ].filter(Boolean);
  return items.length ? items.join(" · ") : "未提取到明确的预算、对象或偏好";
}

export function buildTeaAnswer(query: string): TeaAnswer {
  const intentResult = classifyTeaIntent(query);
  const retrieval = retrieveTeaKnowledge(query, intentResult);
  const hasEvidence = retrieval.products.length > 0 || retrieval.knowledge.length > 0;
  const baseExecution = [
    { label: "接收用户问题", detail: "已收到本轮输入", status: "completed" as const },
    { label: "识别需求", detail: `${intentLabels[intentResult.intent]} · ${entitySummary(intentResult.entities)}`, status: "completed" as const },
  ];

  if (intentResult.intent === "unknown" || !hasEvidence) {
    return {
      answer: "当前知识库中没有可以支持该问题的信息，我不会根据缺失资料生成答案。你可以询问选茶推荐、已收录产品信息，或冲泡方式。",
      recommendations: [],
      sources: [],
      execution: [
        ...baseExecution,
        { label: "检索知识库", detail: "无有效来源", status: "empty" },
        { label: "生成回答", detail: "按知识库边界返回", status: "completed" },
      ],
    };
  }

  const recommendations = intentResult.intent === "product_recommendation" || intentResult.intent === "gift_recommendation"
    ? retrieval.products.slice(0, 2)
    : [];
  const firstProduct = retrieval.products[0];
  const firstDocument = retrieval.knowledge[0];
  let answer = "";

  if (intentResult.intent === "brewing_question") {
    answer = `${firstDocument?.excerpt ?? firstProduct.brewing} 如需选择具体茶品，也可以补充你的口感偏好与使用场景。`;
  } else if (intentResult.intent === "product_question") {
    answer = `${firstProduct.name}：${firstProduct.description} 规格为 ${firstProduct.spec}，风味是「${firstProduct.flavor}」。${firstProduct.brewing}`;
  } else if (recommendations.length) {
    const summary = recommendations.map((product) => `「${product.name}」`).join("和");
    answer = `根据本轮识别到的${entitySummary(intentResult.entities)}，我优先匹配了 ${summary}。它们均来自当前 POC 知识库的商品资料，下面给出结构化推荐理由与参考来源。`;
  } else {
    answer = `${firstProduct.name}与本轮问题的匹配度较高：${firstProduct.description}`;
  }

  return {
    answer,
    recommendations,
    sources: retrieval.knowledge.slice(0, 3),
    execution: [
      ...baseExecution,
      { label: "检索知识库", detail: `命中 ${retrieval.knowledge.length} 条资料`, status: "completed" },
      { label: "匹配商品", detail: `找到 ${retrieval.products.length} 个候选 SKU`, status: "completed" },
      { label: "生成推荐结果", detail: "已完成（Mock RAG）", status: "completed" },
    ],
  };
}
