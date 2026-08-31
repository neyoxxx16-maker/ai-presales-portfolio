import type { GroundedOutput } from "@/lib/rag/types";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

function config() {
  return {
    key: process.env.DEEPSEEK_API_KEY,
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL,
  };
}

function parseJsonOutput(content: unknown): GroundedOutput {
  if (typeof content !== "string" || !content.trim()) throw new Error("provider_malformed_output");
  const json = content.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(json) as GroundedOutput;
}

export function isDeepSeekConfigured() {
  return Boolean(config().key);
}

export const deepSeekProvider = {
  async generate(instructions: string, input: string) {
    const { key, baseUrl, model } = config();
    if (!key) throw new Error("provider_unavailable");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: input },
        ],
        response_format: { type: "json_object" },
        stream: false,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("provider_request_failed");
    const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    return parseJsonOutput(data.choices?.[0]?.message?.content);
  },
};
