import { teaKnowledge } from "@/data/tea-knowledge";
import { teaProducts } from "@/data/tea-products";
import type { IntentResult, RetrievedKnowledge, RetrievedProduct, RetrievalResult, TeaProduct } from "@/types/tea";

function includesAny(query: string, values: string[]) {
  return values.some((value) => query.includes(value.toLowerCase()));
}

function productScore(product: TeaProduct, query: string, intent: IntentResult) {
  let score = 0;
  const reasons: string[] = [];
  const haystack = [product.name, product.category, product.flavor, product.description, ...product.keywords].join(" ").toLowerCase();

  if (query.includes(product.name.toLowerCase())) {
    score += 12;
    reasons.push("命中具体商品");
  }
  if (includesAny(query, product.keywords)) {
    score += 4;
    reasons.push("命中商品关键词");
  }
  if (intent.entities.teaType && product.category === intent.entities.teaType) {
    score += 8;
    reasons.push(`匹配茶类：${intent.entities.teaType}`);
  }
  if (intent.entities.scene === "送礼" && product.scene.some((scene) => scene.includes("赠") || scene.includes("长辈"))) {
    score += 9;
    reasons.push("匹配送礼场景");
  }
  if (intent.intent === "gift_recommendation" && product.category === "礼盒") {
    score += 10;
    reasons.push("礼盒优先匹配送礼需求");
  }
  if (intent.entities.audience === "长辈" && [...product.suitableFor, ...product.scene, ...product.keywords].some((item) => item.includes("长辈"))) {
    score += 7;
    reasons.push("匹配对象：长辈");
  }
  if (intent.entities.preference && (haystack.includes("清香") || haystack.includes("花香"))) {
    score += 5;
    reasons.push(`匹配偏好：${intent.entities.preference}`);
  }
  if (intent.entities.budget) {
    if (product.price <= intent.entities.budget) {
      score += 6;
      reasons.push(`在 ${intent.entities.budget} 元预算内`);
    } else {
      score -= 8;
    }
  }

  return { score, reasons };
}

/**
 * 当前为可替换的 Mock Retrieval 边界：规则评分模拟召回与排序。
 * 后续可在此函数内替换为 embedding + vector search，保留相同返回结构。
 */
export function retrieveTeaKnowledge(query: string, intent: IntentResult): RetrievalResult {
  const normalized = query.toLowerCase();
  const products: RetrievedProduct[] = teaProducts
    .map((product) => {
      const { score, reasons } = productScore(product, normalized, intent);
      return { ...product, score, matchReasons: reasons };
    })
    .filter((product) => product.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const knowledge: RetrievedKnowledge[] = teaKnowledge
    .map((document) => {
      let score = 0;
      const reasons: string[] = [];
      if (includesAny(normalized, document.keywords.map((keyword) => keyword.toLowerCase()))) {
        score += 6;
        reasons.push("命中知识关键词");
      }
      if (intent.intent === "brewing_question" && document.type === "冲泡指南") {
        score += 8;
        reasons.push("匹配冲泡场景");
      }
      if (intent.intent === "gift_recommendation" && document.type === "选购指南") {
        score += 8;
        reasons.push("匹配礼赠场景");
      }
      if (document.productId && products.some((product) => product.id === document.productId)) {
        score += 4;
        reasons.push("关联候选商品");
      }
      return { ...document, score, matchReasons: reasons };
    })
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return { products, knowledge };
}
