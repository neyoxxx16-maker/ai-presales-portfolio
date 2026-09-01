/** Evidence absence is deliberately distinct from a known conflict. */
export type MatchStatus = "PASS" | "PENDING" | "MISSING_EVIDENCE" | "FAIL";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type TenderSectionType =
  | "PROJECT_INFO"
  | "QUALIFICATION"
  | "SCORING"
  | "TECHNICAL"
  | "BUSINESS"
  | "DELIVERY"
  | "AFTER_SALES"
  | "BID_INVALID"
  | "TEMPLATE"
  | "LEGAL"
  | "OTHER";

export type TenderSource = {
  id: string;
  title: string;
  excerpt: string;
  /** User-facing source metadata. `excerpt` is retained for backward compatibility. */
  sourceFile?: string;
  pageNumber?: number;
  quote?: string;
  location: string;
  category: "招标文件" | "演示企业资料" | "真实企业资料" | "外部公开信息";
  documentName?: string;
  chunkId?: string;
  page?: number;
  score?: number;
  retrievalMethod?: RetrievalMethod;
};
export type TenderRequirement = {
  id: string;
  category:
    | "qualification"
    | "technical"
    | "business"
    | "delivery"
    | "after-sales"
    | "time";
  requirement: string;
  mandatory: boolean;
  scoreWeight?: number;
  source: TenderSource;
};
export type TenderProjectInfo = {
  projectName: string;
  projectCode: string;
  purchaser: string;
  agency: string;
  budget: string;
  maxPrice: string;
  procurementMethod: string;
  deadline: string;
  bidOpenTime: string;
  bidOpenLocation: string;
  deliveryPeriod: string;
  location: string;
  targetSummary: string;
  evidence?: Partial<Record<keyof Omit<TenderProjectInfo, "evidence">, TenderSource>>;
};
export type TenderSection = {
  type: TenderSectionType;
  title: string;
  startLine: number;
  content: string[];
  lineNumbers?: number[];
};
export type TenderDocument = {
  name: string;
  content: string;
  canonicalDocumentText: string;
  chunkingMethod: "heading" | "fallback";
  projectInfo: TenderProjectInfo;
  sections: TenderSection[];
  requirements: TenderRequirement[];
  scoringRules: Array<{
    category: string;
    score: string;
    description: string;
    source: TenderSource;
  }>;
  scoringStatus: ScoringStatus;
  deliverables: string[];
};

export type EvidenceStatus = "valid" | "partial" | "missing" | "expired";
export type KnowledgeRecord = {
  evidenceId: string;
  id: string;
  category:
    | "company"
    | "qualification"
    | "personnel"
    | "case"
    | "product"
    | "delivery"
    | "after-sales"
    | "policy";
  title: string;
  content: string;
  tags: string[];
  sourceFile: string;
  status: EvidenceStatus;
  validFrom?: string;
  validTo?: string;
  synthetic: boolean;
  source: TenderSource;
};
export type ToolResult = {
  tool: string;
  query: string;
  results: KnowledgeRecord[];
  sources: TenderSource[];
  confidence: "high" | "medium" | "low";
  status: "completed" | "not_configured" | "skipped" | "failed";
};
export type PlannerStep = {
  tool: TenderToolName;
  reason: string;
  required: boolean;
};
export type TenderToolName =
  | "parseTenderDocument"
  | "ocrDocument"
  | "retrieveCompanyKnowledge"
  | "webVerify"
  | "analyzeQualification"
  | "analyzeTechnicalDeviation"
  | "analyzeScoring"
  | "generateTechnicalResponse"
  | "finalBidRecommendation";
export type PlannerOutput = {
  mode: "deepseek-tool-calling" | "policy-state-machine";
  steps: PlannerStep[];
  rationale: string;
};
export type AgentTraceStatus =
  "planned" | "running" | "success" | "skipped" | "fallback" | "failed";
export type AgentDecisionSource = "llm" | "rule" | "fallback";
export type ExecutionStep = {
  id: TenderToolName;
  label: string;
  purpose: string;
  reason: string;
  inputSummary: string;
  resultSummary: string;
  sources: TenderSource[];
  status: "completed" | "not_configured" | "skipped" | "failed";
  durationMs: number;
  trace: {
    runId: string;
    stepId: string;
    timestamp: string;
    type: "tool";
    tool: TenderToolName;
    status: AgentTraceStatus;
    decisionSource: AgentDecisionSource;
    sourceCount: number;
    observation: string;
    provider?: string;
    retrievalMethod?: RetrievalMethod | "mixed";
    fallback?: string;
    error?: string;
  };
};
export type RequirementMatch = {
  requirementId: string;
  requirement: string;
  category: string;
  status: MatchStatus;
  risk: RiskLevel;
  ourCapability: string;
  reason: string;
  evidenceIds: string[];
  sourceFiles: string[];
  evidence: TenderSource[];
  suggestedAction: string;
  mandatory: boolean;
  scoreWeight?: number;
};
export type TenderRisk = {
  level: RiskLevel;
  title: string;
  description: string;
  relatedRequirementIds: string[];
};
export type PresalesStrategyAnalysis = {
  competitorAnalysis: {
    mode: "known_competitors" | "score_based_simulation";
    summary: string;
    likelyCompetitionAreas: Array<{
      dimension: string;
      scoreWeight: string;
      competitorLikelyStrategy: string;
      ourCurrentPosition: string;
      evidence: TenderSource[];
      confidence: "high" | "medium" | "low";
    }>;
    differentiationStrategies: Array<{
      strategy: string;
      targetScoreItem: string;
      reason: string;
      expectedBenefit: string;
      action: string;
      evidence: TenderSource[];
    }>;
    evidence: TenderSource[];
  };
  controlRiskAnalysis: {
    overallRisk: "low" | "medium" | "high";
    summary: string;
    suspiciousClauses: Array<{
      clause: string;
      category: string;
      riskLevel: "medium" | "high";
      reason: string;
      evidence: TenderSource[];
      possibleImpact: string;
      responseStrategy: string;
      confidence: "medium" | "low";
    }>;
    recommendations: string[];
  };
  scoreSprint: {
    totalAvailableScore: number;
    confirmedScore?: number;
    potentialScore?: number;
    summary: string;
    mustWin: string[];
    fightFor: string[];
    lowPriority: string[];
    difficultOrGiveUp: string[];
    actions: Array<{
      priority: "must_win" | "fight_for" | "low_priority" | "difficult";
      scoreItem: string;
      availableScore: string;
      currentStatus: MatchStatus;
      gap: string;
      recommendedAction: string;
      evidence: TenderSource[];
    }>;
  };
  riskRadar: {
    overallRisk: "low" | "medium" | "high";
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    risks: Array<{
      title: string;
      category: string;
      severity: "critical" | "high" | "medium" | "low";
      clause: string;
      reason: string;
      consequence: string;
      recommendation: string;
      evidence: TenderSource[];
      status: "confirmed" | "suspected" | "needs_confirmation";
    }>;
  };
  evaluation: {
    evidenceCoverage: number;
    completeness: number;
    uncertaintyHandling: number;
    unsupportedClaims: number;
    overallQuality: "A" | "B" | "C" | "D";
  };
};
export type SolutionSection = {
  title: string;
  tenderRequirement: string;
  responseStatus: MatchStatus;
  responseSuggestion: string;
  capabilities: string[];
  cases: string[];
  pendingConfirmation: string[];
  sources: TenderSource[];
};
export type AnalysisSummary = {
  analyzed: boolean;
  totalRequirements: number;
  passCount: number;
  pendingCount: number;
  missingEvidenceCount: number;
  failCount: number;
  highRiskCount: number;
  manualReviewCount: number;
  evidenceCoverage: number;
  readinessScore: number;
  readinessFormula: string;
  recommendation: string;
};
export type ScoringAnalysis = {
  id: string;
  category: string;
  item: string;
  maxScore: string;
  scoringRules: string[];
  bidEvidence: TenderSource[];
  companyEvidence: TenderSource[];
  estimatedScore: string;
  estimatedScoreMin?: number;
  estimatedScoreMax?: number;
  confidence: "high" | "medium" | "low";
  status: MatchStatus;
  risk: RiskLevel;
  reason: string;
  manualReviewRequired: boolean;
};
export type ScoringStatus =
  | "SCORING_FOUND"
  | "SCORING_SUSPECTED"
  | "SCORING_NOT_FOUND";
export type AgentToolCoverage = {
  tool: TenderToolName;
  status: "called" | "skipped" | "not_called";
  reason: string;
};
export type EvidenceConflict = {
  requirementId: string;
  requirement: string;
  internalSources: TenderSource[];
  externalSources: TenderSource[];
  judgment: string;
};
export type AgentDebug = {
  runId: string;
  model: string;
  agentType: PlannerOutput["mode"];
  decisionSource: AgentDecisionSource;
  actualToolCalls: TenderToolName[];
  events: ExecutionStep["trace"][];
  providerStatus: {
    deepSeek: "configured" | "not_configured";
    ocr: "configured" | "not_configured";
    tavily: "configured" | "not_configured";
    embedding: "enabled" | "disabled";
  };
};
export type TaskCompletionItem = {
  id: string;
  label: string;
  status: "completed" | "not_applicable" | "insufficient_evidence" | "execution_failed";
  detail: string;
};
export type TaskCompletion = {
  score: number;
  status: "completed" | "partial" | "execution_failed";
  tasks: TaskCompletionItem[];
};
export type TenderAgentResult = {
  document: TenderDocument;
  planner: PlannerOutput;
  execution: ExecutionStep[];
  toolResults: ToolResult[];
  matches: RequirementMatch[];
  matchScore: {
    value: number;
    formula: string;
    passed: number;
    pending: number;
    missingEvidence: number;
    failed: number;
  };
  analysisSummary: AnalysisSummary;
  scoringAnalysis: ScoringAnalysis[];
  scoringStatus: ScoringStatus;
  risks: TenderRisk[];
  presalesStrategy: PresalesStrategyAnalysis;
  solution: { outline: string[]; sections: SolutionSection[] };
  externalVerification: ExternalVerification;
  evidenceConflicts: EvidenceConflict[];
  companyMode: CompanyWorkspaceMode;
  notice: string;
  usedFallback: boolean;
  file?: ParsedBidDocument;
  files?: ParsedBidDocument[];
  agentConclusion: string;
  finalAnswer: string;
  finalAnswerStatus: "generated" | "failed" | "not_required";
  finalAnswerError?: string;
  taskCompletion: TaskCompletion;
  toolCoverage: AgentToolCoverage[];
  debug?: AgentDebug;
};
export type TenderAgentRequest = {
  mode: "sample" | "upload";
  fileName?: string;
  content?: string;
  file?: File;
  files?: File[];
  companyMode?: CompanyWorkspaceMode;
  task?: string;
};
export type BidDocumentFileType =
  "TXT" | "MARKDOWN" | "DOCX" | "PDF" | "PNG" | "JPG" | "JPEG";
export type BidDocumentParseStatus = "PARSED" | "OCR_REQUIRED";
export type ParsedBidDocument = {
  fileName: string;
  fileType: BidDocumentFileType;
  fileSize: number;
  text: string;
  canonicalDocumentText: string;
  characterCount: number;
  sectionCount: number;
  chunkingMethod: "heading" | "fallback";
  pageCount?: number;
  /** Text kept per original PDF/OCR page so citations never infer a page from character offsets. */
  pages?: Array<{ pageNumber: number; text: string }>;
  parseMethod: "plain_text" | "docx_mammoth" | "pdf_text" | "ocr";
  status: BidDocumentParseStatus;
  warning?: string;
};
export type CompanyWorkspaceMode = "demo" | "workspace";
export type CompanyDocumentCategory =
  | "company"
  | "qualification"
  | "personnel"
  | "case"
  | "product"
  | "capability"
  | "delivery"
  | "after-sales"
  | "other";
export type CompanyDocumentStatus =
  "PARSED" | "OCR_FAILED" | "OCR_UNAVAILABLE" | "FAILED";
export type CompanyDocument = {
  documentId: string;
  fileName: string;
  fileType: "PDF" | "DOCX" | "TXT" | "MARKDOWN" | "PNG" | "JPG" | "JPEG";
  category: CompanyDocumentCategory;
  uploadTime: string;
  parseStatus: CompanyDocumentStatus;
  parseMethod: "plain_text" | "docx_mammoth" | "pdf_text" | "ocr" | "none";
  textLength: number;
  pageCount?: number;
  synthetic: false;
  sourceType: "USER_UPLOAD";
  validFrom?: string;
  validTo?: string;
  issuer?: string;
  tags: string[];
  notes?: string;
  filePath: string;
  textPath?: string;
  chunkCount: number;
  indexed: boolean;
  indexMethod: "KEYWORD" | "VECTOR" | "HYBRID";
  warnings: string[];
};
export type CompanyEvidenceChunk = {
  chunkId: string;
  documentId: string;
  content: string;
  sourceFile: string;
  quote: string;
  category: CompanyDocumentCategory;
  sectionTitle: string;
  page?: number;
  pageNumber?: number;
  metadata: Pick<
    CompanyDocument,
    "fileName" | "validFrom" | "validTo" | "issuer" | "tags" | "notes" | "parseMethod"
  >;
  embedding?: number[];
};
export type RetrievalMethod = "KEYWORD" | "VECTOR" | "HYBRID";
export type RetrievedCompanyEvidence = {
  evidenceId: string;
  documentId: string;
  chunkId: string;
  content: string;
  quote: string;
  category: CompanyDocumentCategory;
  score: number;
  retrievalMethod: RetrievalMethod;
  sourceFile: string;
  page?: number;
  pageNumber?: number;
  sectionTitle: string;
  validFrom?: string;
  validTo?: string;
  validation: "VALID" | "EXPIRED" | "INSUFFICIENT" | "CONFLICT" | "UNKNOWN";
};
export type ExternalVerification = {
  enabled: boolean;
  status: "NOT_CONFIGURED" | "NOT_EXECUTED" | "COMPLETED" | "FAILED";
  query?: string;
  error?: string;
  projectBound?: boolean;
  projectConflicts?: Array<{
    field: string;
    fileValue: string;
    fileSource: string;
    externalValue: string;
    title: string;
    url: string;
  }>;
  results: Array<{
    title: string;
    url: string;
    domain: string;
    publishedAt?: string;
    retrievedAt: string;
    snippet: string;
    provider: string;
    confidence: "high" | "medium" | "low";
    projectMatch?: "MATCHED" | "UNCONFIRMED" | "CONFLICT";
    matchReasons?: string[];
  }>;
};
