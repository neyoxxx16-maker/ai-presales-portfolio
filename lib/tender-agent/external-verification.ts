import type { ExternalVerification } from "@/types/tender-agent";

// TAVILY_API_KEY is canonical; retain the legacy name only for private deployment migration.
const tavilyKey = () => process.env.TAVILY_API_KEY || process.env.TENDER_WEB_SEARCH_API_KEY;
export const tavilyConfigured = () => Boolean(tavilyKey());
export async function externalSearch(query: string): Promise<ExternalVerification> {
  const key = tavilyKey(); if (!key) return { enabled: false, status: "NOT_CONFIGURED", results: [] };
  try { const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: key, query, search_depth: "basic", max_results: 5, include_answer: false }), signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error(`search_${response.status}`); const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> }; return { enabled: true, status: "COMPLETED", results: (data.results ?? []).map((item) => { const url = item.url ?? ""; let domain = ""; try { domain = new URL(url).hostname; } catch { domain = "unknown"; } const official = /\.gov\.cn$|\.edu\.cn$|\.org\.cn$/.test(domain); return { title: item.title ?? "未命名来源", url, domain, publishedAt: item.published_date, retrievedAt: new Date().toISOString(), snippet: item.content ?? "", provider: "tavily", confidence: official ? "high" : domain ? "medium" : "low" }; }) }; } catch { return { enabled: true, status: "FAILED", results: [] }; }
}
