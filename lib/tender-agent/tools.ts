import { tenderKnowledge } from "@/data/tender/knowledge";
import type { KnowledgeRecord, TenderSource, ToolResult } from "@/types/tender-agent";

const normalize = (value: string) => value.toLowerCase().replace(/[\s，。；、：：“”()（）/]/g, "");
function score(query: string, record: KnowledgeRecord) {
  const normalized = normalize(query); const text = normalize(`${record.title}${record.content}`);
  const tagHits = record.tags.filter((tag) => normalized.includes(normalize(tag))).length;
  const titleHit = normalized.includes(normalize(record.title)) || normalize(record.title).includes(normalized);
  return tagHits * 8 + (titleHit ? 12 : 0) + (text.includes(normalized) ? 4 : 0);
}
export function searchCompanyEvidence(query: string, categories?: KnowledgeRecord["category"][]) {
  return tenderKnowledge.filter((record) => !categories || categories.includes(record.category)).map((record) => ({ record, score: score(query, record) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id)).slice(0, 12).map((item) => item.record);
}
function retrieve(query: string, categories: KnowledgeRecord["category"][], tool: string): ToolResult {
  const results = searchCompanyEvidence(query, categories);
  return { tool, query, results, sources: results.map((result) => result.source), confidence: results.length >= 2 ? "high" : results.length ? "medium" : "low", status: "completed" };
}
/** Legacy evidence helpers retained for existing regression coverage; Agent tools are registered in orchestrator.ts. */
export const toolRegistry: Record<string, (query: string) => ToolResult> = {
  search_company_qualification: (query) => retrieve(query, ["company", "qualification", "personnel"], "search_company_qualification"),
  search_product_capability: (query) => retrieve(query, ["product", "case", "delivery", "after-sales"], "search_product_capability"),
  search_historical_cases: (query) => retrieve(query, ["case"], "search_historical_cases"),
  search_external_web: (query) => ({ tool: "search_external_web", query, results: [], sources: [], confidence: "low", status: "not_configured" }),
};
export function sourceFor(records: KnowledgeRecord[], id: string): TenderSource[] { return records.filter((record) => record.id === id).map((record) => record.source); }
