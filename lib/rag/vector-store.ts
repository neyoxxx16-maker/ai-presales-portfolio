import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RagConfig, RetrievalResult, TeaVectorIndex, VectorHit } from "@/lib/rag/types";

export const RAG_CONFIG: RagConfig = { topK: 5, threshold: 0.28, timeoutMs: 8000 };
export const vectorIndexPath = path.join(process.cwd(), "data", "generated", "tea-vector-index.json");

export async function loadTeaVectorIndex() {
  try { return JSON.parse(await readFile(vectorIndexPath, "utf8")) as TeaVectorIndex; } catch { return undefined; }
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || !left.length) return 0;
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftNorm += left[index] ** 2; rightNorm += right[index] ** 2; }
  return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0;
}

export function searchTeaVectorIndex(index: TeaVectorIndex, queryEmbedding: number[], filters: { productIds?: string[]; categories?: string[] } = {}): RetrievalResult {
  const hits: VectorHit[] = index.chunks.map((chunk) => {
    const productBoost = filters.productIds?.length && chunk.productIds.some((id) => filters.productIds?.includes(id)) ? 0.08 : 0;
    const categoryBoost = filters.categories?.includes(chunk.category) ? 0.06 : 0;
    return { ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) + productBoost + categoryBoost };
  }).sort((left, right) => right.score - left.score).slice(0, RAG_CONFIG.topK);
  return { hits, insufficientContext: !hits.length || hits[0].score < RAG_CONFIG.threshold };
}
