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
const safeErrorMessage = (value: unknown) => typeof value === "string"
  ? value.replace(/(?:api[_ -]?key|token|authorization)\s*[:=]\s*[^\s,;]+/gi, "[redacted]").slice(0, 180)
  : undefined;
function tavilyDiagnostic(values: { httpStatus?: number; errorType?: string; errorMessage?: string; durationMs: number; queryLength: number; retryAttempted: boolean; resultCount: number }) {
  console.info("[tender-tavily]", values);
}
export async function externalSearch(query: string, options: ExternalSearchOptions = {}): Promise<ExternalVerification> {
  const key = tavilyKey(); if (!key) return { enabled: false, status: "NOT_CONFIGURED", query, error: "missing_api_key", results: [] };
  const body = JSON.stringify({ api_key: key, query, search_depth: "advanced", max_results: options.maxResults ?? 5, include_answer: false, ...(options.includeDomains?.length ? { include_domains: options.includeDomains } : {}) });
  let retryAttempted = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    try {
      const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(15000) });
      const durationMs = Date.now() - started;
      if (!response.ok) {
        const payload = await response.json().catch(() => undefined) as { error?: unknown; message?: unknown } | undefined;
        const errorMessage = safeErrorMessage(payload?.error ?? payload?.message);
        const errorType = `http_${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt === 0) {
          retryAttempted = true;
          tavilyDiagnostic({ httpStatus: response.status, errorType, errorMessage, durationMs, queryLength: query.length, retryAttempted, resultCount: 0 });
          continue;
        }
        tavilyDiagnostic({ httpStatus: response.status, errorType, errorMessage, durationMs, queryLength: query.length, retryAttempted, resultCount: 0 });
        return { enabled: true, status: "FAILED", query, error: errorType, results: [] };
      }
      const data = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }> };
      const allowedDomains = options.includeDomains?.map((item) => item.toLowerCase());
      const results = (data.results ?? []).map((item) => { const url = item.url ?? ""; let domain = ""; try { domain = new URL(url).hostname; } catch { domain = "unknown"; } const official = /\.gov\.cn$|\.edu\.cn$|\.org\.cn$/.test(domain); const confidence: "high" | "medium" | "low" = official ? "high" : domain ? "medium" : "low"; return { title: item.title ?? "未命名来源", url, domain, publishedAt: item.published_date, retrievedAt: new Date().toISOString(), snippet: item.content ?? "", provider: "tavily", confidence }; }).filter((item) => item.url).filter((item) => !allowedDomains?.length || allowedDomains.some((domain) => item.domain === domain || item.domain.endsWith(`.${domain}`))).sort((a, b) => options.sortByPublishedDate ? publishedTimestamp(b.publishedAt) - publishedTimestamp(a.publishedAt) || Number(b.confidence === "high") - Number(a.confidence === "high") : Number(b.confidence === "high") - Number(a.confidence === "high"));
      tavilyDiagnostic({ httpStatus: response.status, errorType: results.length ? undefined : "no_results", durationMs, queryLength: query.length, retryAttempted, resultCount: results.length });
      return results.length ? { enabled: true, status: "COMPLETED", query, results } : { enabled: true, status: "FAILED", query, error: "no_results", results: [] };
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : "network_error";
      const errorType = error instanceof SyntaxError ? "invalid_response" : /timeout/i.test(message) ? "timeout" : "network_error";
      if ((errorType === "network_error" || errorType === "timeout") && attempt === 0) {
        retryAttempted = true;
        tavilyDiagnostic({ errorType, errorMessage: safeErrorMessage(message), durationMs, queryLength: query.length, retryAttempted, resultCount: 0 });
        continue;
      }
      tavilyDiagnostic({ errorType, errorMessage: safeErrorMessage(message), durationMs, queryLength: query.length, retryAttempted, resultCount: 0 });
      return { enabled: true, status: "FAILED", query, error: errorType, results: [] };
    }
  }
  return { enabled: true, status: "FAILED", query, error: "network_error", results: [] };
}
