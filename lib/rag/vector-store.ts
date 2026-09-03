import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RagConfig, RetrievalResult, TeaVectorIndex, VectorHit } from "@/lib/rag/types";

export const RAG_CONFIG: RagConfig = { topK: 5, threshold: 0.28, timeoutMs: 8000 };
export const vectorIndexPath = path.join(process.cwd(), "data", "generated", process.env.EMBEDDING_PROVIDER === "openai-compatible" ? "tea-vector-index-production-512.json" : "tea-vector-index.json");

let vectorIndexPromise: Promise<TeaVectorIndex | undefined> | undefined;

export async function loadTeaVectorIndex() {
  vectorIndexPromise ??= readFile(vectorIndexPath, "utf8")
    .then((content) => JSON.parse(content) as TeaVectorIndex)
    .catch(() => undefined);
  return vectorIndexPromise;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || !left.length) return 0;
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) { dot += left[index] * right[index]; leftNorm += left[index] ** 2; rightNorm += right[index] ** 2; }
  return leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : 0;
}

export function searchTeaVectorIndex(index: TeaVectorIndex, queryEmbedding: number[], filters: { query?: string; productIds?: string[]; categories?: string[] } = {}): RetrievalResult {
  const vectorRanked = index.chunks.map((chunk) => {
    const productBoost = filters.productIds?.length && chunk.productIds.some((id) => filters.productIds?.includes(id)) ? 0.08 : 0;
    const categoryBoost = filters.categories?.includes(chunk.category) ? 0.06 : 0;
    const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding) + productBoost + categoryBoost;
    return { ...chunk, score: vectorScore, vectorScore };
  }).sort((left, right) => right.vectorScore - left.vectorScore);
  const normalize = (value: string) => value.toLowerCase().replace(/[\s，。；、：：“”()（）/]/g, "");
  const normalizedQuery = normalize(filters.query ?? "");
  const phrases = normalizedQuery.match(/[\u4e00-\u9fa5]{2,8}/g) ?? [];
  const ascii = normalizedQuery.match(/[a-z0-9]{2,}/g) ?? [];
  const keywordRanked = index.chunks.map((chunk) => {
    const target = normalize(`${chunk.title} ${chunk.content} ${chunk.tags.join(" ")}`);
    const exactTags = chunk.tags.filter((tag) => normalizedQuery.includes(normalize(tag))).length;
    const titleMatch = normalizedQuery && target.includes(normalizedQuery) ? 6 : 0;
    const phraseMatches = phrases.filter((phrase) => target.includes(phrase)).length;
    const asciiMatches = ascii.filter((term) => target.includes(term)).length;
    const keywordScore = exactTags * 8 + titleMatch + phraseMatches * 2 + asciiMatches * 4;
    return { ...chunk, score: keywordScore, keywordScore };
  }).filter((hit) => hit.keywordScore > 0).sort((left, right) => right.keywordScore - left.keywordScore);
  const rrf = new Map<string, number>();
  const addRrf = (hits: Array<{ id: string }>) => hits.forEach((hit, index) => rrf.set(hit.id, (rrf.get(hit.id) ?? 0) + 1 / (60 + index + 1)));
  addRrf(vectorRanked);
  addRrf(keywordRanked);
  const vectorById = new Map(vectorRanked.map((hit) => [hit.id, hit]));
  const keywordById = new Map(keywordRanked.map((hit) => [hit.id, hit]));
  const hits: VectorHit[] = [...rrf.keys()].map((id) => {
    const vector = vectorById.get(id)!;
    const keyword = keywordById.get(id);
    return {
      ...vector,
      keywordScore: keyword?.keywordScore,
      rrfScore: rrf.get(id),
      score: rrf.get(id)!,
      retrievalMethod: keyword ? "HYBRID" as const : "VECTOR" as const,
    };
  }).sort((left, right) => right.score - left.score).slice(0, RAG_CONFIG.topK);
  const topVectorScore = vectorRanked[0]?.vectorScore ?? 0;
  return { hits, insufficientContext: !hits.length || (topVectorScore < RAG_CONFIG.threshold && !keywordRanked.length), keywordHits: keywordRanked.length, vectorHits: vectorRanked.length, hybridActive: Boolean(vectorRanked.length) && Boolean(keywordRanked.length) };
}
