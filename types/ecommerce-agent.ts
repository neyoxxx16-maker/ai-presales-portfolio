export type EcommerceTaskType = "selling_points" | "xiaohongshu" | "product_detail" | "customer_service";
export type ContentPlatform = "xiaohongshu" | "douyin" | "channels" | "feed" | "general";
export type ContentGoal = "seeding" | "launch" | "education" | "brand" | "conversion" | "knowledge";
export type StylePreset = "conversion" | "humor" | "education" | "xiaohongshu" | "story" | "premium" | "custom";

export type EcommerceProductFacts = {
  skuId: string;
  skuName: string;
  productNames: string[];
  specification: string;
  netContent: string;
  packaging: string;
  price?: { amount: number; label: "售价" | "新客价"; originalPrice?: number; shippingIncluded?: boolean };
  supportedSellingPoints: string[];
  unavailableFields: string[];
};

export type ValidationIssue = { field: "SKU" | "商品名" | "规格 / 净含量" | "包装" | "价格"; message: string; severity: "warning" | "error" };
export type ValidationResult = { passed: boolean; issues: ValidationIssue[]; checkedFields: string[] };

export type RiskIssue = { category: "绝对化表达" | "无依据声明" | "商业合规" | "参数冲突"; message: string; severity: "attention" | "block" };
export type RiskReview = { level: "low" | "attention" | "block"; issues: RiskIssue[]; suggestions: string[] };

export type AgentWorkflowStep = {
  id: "get_product_facts" | "generate_candidate" | "validate_product_claims" | "scan_content_risk" | "finalize_content";
  label: string;
  status: "completed" | "failed";
  detail: string;
};

export type EcommerceAgentRequest = {
  skuId: string;
  taskType: EcommerceTaskType;
  style?: string;
  audience?: string;
  scene?: string;
  length?: string;
  requirements?: string;
  platform?: ContentPlatform;
  goal?: ContentGoal;
  sellingPoints?: string[];
  duration?: "15" | "30" | "60" | "90";
  referenceText?: string;
  customStyle?: string;
};

export type ContentAngle = { title: string; rationale: string; score: { clickPotential: number; relevance: number; emotion: number; information: number; differentiation: number; brandFit: number; commercialValue: number; total: number } };
export type VideoScene = { sceneNumber: number; duration: string; voiceover: string; visual: string; shotType: string; action: string; subtitle: string; transition: string; audio: string };
export type ContentPackage = { strategy: { platform: ContentPlatform; goal: ContentGoal; audience: string; sellingPoints: string[]; style: StylePreset; styleProfile: string[] }; angles: ContentAngle[]; selectedAngle: ContentAngle; titles: Array<{ type: string; text: string }>; hooks: Array<{ type: string; text: string }>; copy: string; videoScript: { duration: string; scenes: VideoScene[] }; visualPlan: string[]; coverIdeas: Array<{ title: string; subject: string; composition: string; hierarchy: string }>; socialCards: Array<{ page: number; role: string; headline: string; content: string }>; ctas: Array<{ type: string; text: string }>; brandVoice: { passed: boolean; notes: string[] }; decisionSummary: string[] };

export type EcommerceAgentResult = {
  taskType: EcommerceTaskType;
  product: EcommerceProductFacts;
  generatedContent: string;
  verifiedFacts: string[];
  validation: ValidationResult;
  riskReview: RiskReview;
  status: "ready_for_review" | "needs_revision" | "blocked";
  workflow: AgentWorkflowStep[];
  contentPackage?: ContentPackage;
};

export type EcommerceAgentErrorCode = "invalid_request" | "product_not_found" | "provider_unavailable" | "provider_timeout" | "provider_failed" | "provider_malformed" | "tool_failed";
