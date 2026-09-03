import type { ExternalVerification } from "@/types/tender-agent";

// TAVILY_API_KEY is canonical; retain the legacy name only for private deployment migration.
const tavilyKey = () => process.env.TAVILY_API_KEY || process.env.TENDER_WEB_SEARCH_API_KEY;
export const tavilyConfigured = () => Boolean(tavilyKey());
type ExternalSearchOptions = { includeDomains?: string[]; sortByPublishedDate?: boolean; maxResults?: number };
const publishedTimestamp = (value?: string) => {
  if (!value) return 0;
  const normalized = value.replace(/[年/.]/g, "-").replace(/月/g, "-").replace(/日/g, "");
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : 0;
};
export async function externalSearch(query: string, options: ExternalSearchOptions = {}): Promise<ExternalVerification> {
  const key = tavilyKey(); if (!key) return { enabled: false, status: "NOT_CONFIGURED", query, error: "missing_api_key", results: [] };
  try { const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: key, query, search_depth: "advanced", max_results: options.maxResults ?? 5, include_answer: false, ...(options.includeDomains?.length ? { include_domains: options.includeDomains } : {}) }), signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error(`http_${response.status}`); const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> }; const allowedDomains = options.includeDomains?.map((item) => item.toLowerCase()); const results = (data.results ?? []).map((item) => { const url = item.url ?? ""; let domain = ""; try { domain = new URL(url).hostname; } catch { domain = "unknown"; } const official = /\.gov\.cn$|\.edu\.cn$|\.org\.cn$/.test(domain); const confidence: "high" | "medium" | "low" = official ? "high" : domain ? "medium" : "low"; return { title: item.title ?? "未命名来源", url, domain, publishedAt: item.published_date, retrievedAt: new Date().toISOString(), snippet: item.content ?? "", provider: "tavily", confidence }; }).filter((item) => item.url).filter((item) => !allowedDomains?.length || allowedDomains.some((domain) => item.domain === domain || item.domain.endsWith(`.${domain}`))).sort((a, b) => options.sortByPublishedDate ? publishedTimestamp(b.publishedAt) - publishedTimestamp(a.publishedAt) || Number(b.confidence === "high") - Number(a.confidence === "high") : Number(b.confidence === "high") - Number(a.confidence === "high")); return results.length ? { enabled: true, status: "COMPLETED", query, results } : { enabled: true, status: "FAILED", query, error: "no_results", results: [] }; } catch (error) { const message = error instanceof Error ? error.message : "network_error"; return { enabled: true, status: "FAILED", query, error: /timeout/i.test(message) ? "timeout" : message, results: [] }; }
}
