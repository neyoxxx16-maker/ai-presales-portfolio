import { embedLocally, localEmbeddingConfig } from "@/lib/rag/local-embeddings";

export type EmbeddingProviderStatus = { enabled: boolean; provider: "local" | "openai-compatible" | "none"; model?: string; dimensions?: number };

function settings() {
  return {
    provider: process.env.EMBEDDING_PROVIDER ?? process.env.TENDER_EMBEDDING_PROVIDER ?? "none",
    baseUrl: process.env.EMBEDDING_BASE_URL ?? process.env.TENDER_EMBEDDING_BASE_URL,
    apiKey: process.env.EMBEDDING_API_KEY ?? process.env.TENDER_EMBEDDING_API_KEY,
    model: process.env.EMBEDDING_MODEL ?? process.env.TENDER_EMBEDDING_MODEL,
    dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? process.env.TENDER_EMBEDDING_DIMENSIONS ?? 512),
  };
}

export function embeddingProviderStatus(): EmbeddingProviderStatus {
  const config = settings();
  if (config.provider === "local") return { enabled: true, provider: "local", model: localEmbeddingConfig.model, dimensions: 384 };
  if (config.provider === "openai-compatible" && config.baseUrl && config.apiKey && config.model && config.dimensions > 0) return { enabled: true, provider: "openai-compatible", model: config.model, dimensions: config.dimensions };
  return { enabled: false, provider: "none" };
}

export async function embedTexts(input: string[]): Promise<number[][]> {
  const status = embeddingProviderStatus();
  if (!status.enabled) throw new Error("embedding_not_configured");
  if (status.provider === "local") return embedLocally(input);
  const config = settings();
  const vectors: number[][] = [];
  for (let start = 0; start < input.length; start += 8) {
    const response = await fetch(`${config.baseUrl!.replace(/\/$/, "")}/embeddings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, input: input.slice(start, start + 8), dimensions: config.dimensions }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`embedding_request_failed_${response.status}`);
    const data = await response.json() as { data?: Array<{ index: number; embedding: number[] }> };
    vectors.push(...(data.data ?? []).sort((a, b) => a.index - b.index).map((item) => item.embedding));
  }
  if (vectors.length !== input.length || vectors.some((vector) => vector.length !== status.dimensions)) throw new Error("embedding_dimension_mismatch");
  return vectors;
}
