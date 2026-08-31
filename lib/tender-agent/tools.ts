import { tenderKnowledge } from "@/data/tender/knowledge";
import type { KnowledgeRecord, TenderSource, TenderToolName, ToolResult } from "@/types/tender-agent";

const terms = (value: string) => Array.from(new Set(value.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]+/g) ?? []));
function retrieve(query: string, categories: KnowledgeRecord["category"][], tool: string): ToolResult {
  const queryTerms = terms(query);
  const results = tenderKnowledge.filter((record) => categories.includes(record.category)).map((record) => ({ record, score: terms(`${record.title} ${record.content} ${record.tags.join(" ")}`).filter((term) => queryTerms.some((queryTerm) => term.includes(queryTerm) || queryTerm.includes(term))).length })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(({ record }) => record);
  return { tool, query, results, sources: results.map((result) => result.source), confidence: results.length >= 2 ? "high" : results.length ? "medium" : "low", status: "completed" };
}
export const toolRegistry: Record<Exclude<TenderToolName, "parse_tender_document" | "extract_requirements" | "check_requirement_match" | "generate_solution_response">, (query: string) => ToolResult> = {
  search_company_qualification: (query) => retrieve(query, ["qualification", "delivery"], "search_company_qualification"),
  search_product_capability: (query) => retrieve(query, ["product", "delivery"], "search_product_capability"),
  search_historical_cases: (query) => retrieve(query, ["case"], "search_historical_cases"),
  search_external_web: (query) => ({ tool: "search_external_web", query, results: [], sources: [], confidence: "low", status: "not_configured" }),
};
export function sourceFor(records: KnowledgeRecord[], id: string): TenderSource[] { return records.filter((record) => record.id === id).map((record) => record.source); }
