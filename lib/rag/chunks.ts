import { teaKnowledge } from "@/data/tea/knowledge";
import { teaProducts } from "@/data/tea/products";
import type { TeaKnowledgeChunk } from "@/lib/rag/types";

export function createTeaKnowledgeChunks(): TeaKnowledgeChunk[] {
  return teaKnowledge.map((document) => {
    const productName = document.metadata?.productName;
    const productIds = teaProducts.filter((product) => product.name === productName || product.aliases?.includes(productName ?? "")).map((product) => product.id);
    return { id: document.id, title: document.title, content: `${document.excerpt}\n${document.content}`, category: document.knowledgeType, sourceIds: document.sourceIds, productIds, tags: document.keywords };
  });
}
