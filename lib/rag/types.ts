import type { KnowledgeType, TeaIntent } from "@/types/tea";

export type TeaKnowledgeChunk = {
  id: string;
  title: string;
  content: string;
  category: KnowledgeType;
  sourceIds: string[];
  productIds: string[];
  tags: string[];
};

export type TeaVectorIndex = { version: 1; model: string; dimensions: number; chunks: Array<TeaKnowledgeChunk & { embedding: number[] }> };
export type VectorHit = TeaKnowledgeChunk & { score: number };
export type RetrievalResult = { hits: VectorHit[]; insufficientContext: boolean };
export type GroundedOutput = { answer: string; citations: string[]; confidence: "high" | "medium" | "low"; followUp?: string };
export type RagConfig = { topK: number; threshold: number; timeoutMs: number };
export type RagRequest = { query: string; intent: TeaIntent; productIds?: string[]; structuredFacts: string[]; allowedCitationIds: string[] };
