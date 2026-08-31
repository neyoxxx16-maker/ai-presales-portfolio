export type MatchStatus = "PASS" | "PARTIAL" | "MISSING" | "UNKNOWN";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export type TenderSource = { id: string; title: string; excerpt: string; location: string; category: "招标文件" | "演示企业资料" };
export type TenderRequirement = { id: string; category: "qualification" | "technical" | "delivery" | "time"; requirement: string; mandatory: boolean; scoreWeight?: number; source: TenderSource };
export type TenderProjectInfo = { projectName: string; budget: string; deadline: string; deliveryPeriod: string; location: string };
export type TenderDocument = { name: string; content: string; projectInfo: TenderProjectInfo; requirements: TenderRequirement[]; scoringRules: Array<{ category: string; score: string; description: string; source: TenderSource }>; deliverables: string[] };

export type KnowledgeRecord = { id: string; category: "qualification" | "product" | "case" | "delivery" | "policy"; title: string; content: string; tags: string[]; source: TenderSource };
export type ToolResult = { tool: string; query: string; results: KnowledgeRecord[]; sources: TenderSource[]; confidence: "high" | "medium" | "low"; status: "completed" | "not_configured" | "failed" };
export type PlannerStep = { tool: TenderToolName; reason: string; required: boolean };
export type TenderToolName = "parse_tender_document" | "extract_requirements" | "search_company_qualification" | "search_product_capability" | "search_historical_cases" | "search_external_web" | "check_requirement_match" | "generate_solution_response";
export type PlannerOutput = { mode: "deepseek-structured" | "rule-fallback"; steps: PlannerStep[]; rationale: string };
export type ExecutionStep = { id: TenderToolName; label: string; purpose: string; inputSummary: string; resultSummary: string; sources: TenderSource[]; status: "completed" | "not_configured" | "failed"; durationMs: number };
export type RequirementMatch = { requirementId: string; requirement: string; category: string; status: MatchStatus; risk: RiskLevel; ourCapability: string; evidence: TenderSource[]; suggestedAction: string; mandatory: boolean; scoreWeight?: number };
export type TenderRisk = { level: RiskLevel; title: string; description: string; relatedRequirementIds: string[] };
export type SolutionSection = { title: string; tenderRequirement: string; responseSuggestion: string; capabilities: string[]; cases: string[]; pendingConfirmation: string[]; sources: TenderSource[] };
export type TenderAgentResult = { document: TenderDocument; planner: PlannerOutput; execution: ExecutionStep[]; toolResults: ToolResult[]; matches: RequirementMatch[]; matchScore: { value: number; formula: string; passed: number; partial: number; missing: number; unknown: number }; risks: TenderRisk[]; solution: { outline: string[]; sections: SolutionSection[] }; notice: string; usedFallback: boolean };
export type TenderAgentRequest = { mode: "sample" | "upload"; fileName?: string; content?: string };
