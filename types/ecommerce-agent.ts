export type EcommerceTaskType = "selling_points" | "xiaohongshu" | "product_detail" | "customer_service";

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
};

export type EcommerceAgentResult = {
  taskType: EcommerceTaskType;
  product: EcommerceProductFacts;
  generatedContent: string;
  verifiedFacts: string[];
  validation: ValidationResult;
  riskReview: RiskReview;
  status: "ready_for_review" | "needs_revision" | "blocked";
  workflow: AgentWorkflowStep[];
};

export type EcommerceAgentErrorCode = "invalid_request" | "product_not_found" | "provider_unavailable" | "provider_timeout" | "provider_failed" | "provider_malformed" | "tool_failed";
