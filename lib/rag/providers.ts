import type { GroundedOutput } from "@/lib/rag/types";

const apiBase = "https://api.openai.com/v1";
function config() { return { key: process.env.LLM_API_KEY, model: process.env.LLM_MODEL ?? "gpt-4.1-mini", embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small" }; }
async function openAIRequest(path: string, body: Record<string, unknown>) {
  const { key } = config();
  if (!key) throw new Error("provider_unavailable");
  const response = await fetch(`${apiBase}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("provider_request_failed");
  return response.json() as Promise<Record<string, unknown>>;
}
export const openAIProvider = {
  async embedMany(input: string[]) { const data = await openAIRequest("/embeddings", { model: config().embeddingModel, input }); return (data.data as Array<{ embedding: number[] }>).map((item) => item.embedding); },
  async generate(instructions: string, input: string) {
    const data = await openAIRequest("/responses", { model: config().model, instructions, input, store: false, max_output_tokens: 500 });
    const outputText = typeof data.output_text === "string" ? data.output_text : "";
    if (!outputText) throw new Error("provider_malformed_output");
    return JSON.parse(outputText) as GroundedOutput;
  },
};
