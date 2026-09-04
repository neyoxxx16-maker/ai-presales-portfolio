import { teaKnowledge } from "@/data/tea/knowledge";
import { teaPriceEvidence, teaProducts, teaSkus } from "@/data/tea/products";
import type { TeaKnowledgeChunk } from "@/lib/rag/types";

export function createTeaKnowledgeChunks(): TeaKnowledgeChunk[] {
  const knowledgeChunks = teaKnowledge.map((document) => {
    const productName = document.metadata?.productName;
    const productIds = teaProducts.filter((product) => product.name === productName || product.aliases?.includes(productName ?? "")).map((product) => product.id);
    return { id: document.id, title: document.title, content: `${document.excerpt}\n${document.content}`, category: document.knowledgeType, sourceIds: document.sourceIds, productIds, tags: document.keywords };
  });
  const skuChunks = teaSkus.map((sku) => {
    const price = teaPriceEvidence.find((item) => sku.priceEvidenceIds?.includes(item.id));
    const teaNames = sku.productIds.map((id) => teaProducts.find((product) => product.id === id)?.name).filter(Boolean).join("＋");
    return {
      id: `SKU-${sku.id}`,
      title: `${sku.name} · 具体 SKU`,
      content: `sku_id：${sku.id}\n茶品：${teaNames}\n规格：${sku.spec}\n净含量：${sku.netContent}\n包装形式：${sku.packageType}\n${price ? `价格记录：${price.amount}元${price.originalPrice ? `，划线价${price.originalPrice}元` : ""}` : "价格：待确认"}\n该条仅对应此具体 SKU，不与其他包装或净含量混用。`,
      category: "sku" as const,
      sourceIds: sku.sourceIds,
      productIds: sku.productIds,
      tags: [sku.name, sku.id, sku.spec, sku.netContent, sku.packageType, sku.productFamily, ...sku.productIds],
    };
  });
  return [...knowledgeChunks, ...skuChunks];
}
