export type TeaCategory = "绿茶" | "调味绿茶" | "红茶" | "调味红茶";
export type DataSource = "verified-project-source" | "mock";
export type PriceStatus = "verified_snapshot" | "user_confirmed" | "unverified";

export type TeaProduct = {
  id: string;
  name: string;
  aliases?: string[];
  category: TeaCategory;
  flavor: string[];
  description: string;
  ingredients?: string[];
  suitableFor: string[];
  scene: string[];
  keywords: string[];
  skuIds: string[];
  sourceIds: string[];
  dataSource: "verified-project-source";
};

export type TeaSku = {
  id: string;
  name: string;
  productIds: string[];
  /** 茶品 + 规格 + 包装组合的唯一销售单元；包装类别不是 SKU。 */
  packageType: "试饮装" | "单罐" | "双拼" | "双盒" | "礼盒";
  productFamily: "龙井" | "红茶" | "桂花系列" | "龙井红茶双拼" | "桂花双拼";
  spec: string;
  netContent: string;
  netWeightGrams: number;
  packaging: "试饮装" | "礼盒" | "单盒 / 单罐装";
  priceStatus: PriceStatus;
  priceRelationGroup?: string;
  priceEvidenceIds?: string[];
  saleChannel?: string;
  sourceIds: string[];
  dataSource: "verified-project-source";
};

export type PriceEvidence = {
  id: string;
  skuName: string;
  productName: string;
  spec?: string;
  netContent: string;
  packaging: "试饮装" | "单罐" | "礼盒";
  amount: number;
  currency: "CNY";
  priceType: "new_customer" | "user_confirmed_business_rule";
  originalPrice?: number;
  shippingIncluded?: boolean;
  keywords?: string[];
  combinationTerms?: string[];
  combinationTermGroups?: string[][];
  status: "verified_snapshot" | "user_confirmed";
  sourceId: string;
  saleChannel: "微信小店商品截图" | "用户补充业务口径";
  note: string;
  dataSource: "verified-project-source";
};

export type SourceRecord = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  version: string | null;
  sourceDate: string | null;
  evidenceLevel: string;
};

export type KnowledgeType = "brand_profile" | "tea_type" | "sku" | "brewing" | "aftersales" | "conflict_log" | "recommendation";

export type KnowledgeDocument = {
  id: string;
  title: string;
  type: "品牌资料" | "茶品资料" | "SKU资料" | "冲泡指南" | "售后与边界" | "冲突处理" | "推荐规则";
  knowledgeType: KnowledgeType;
  content: string;
  excerpt: string;
  keywords: string[];
  sourceIds: string[];
  metadata?: {
    productName?: string;
    productAliases?: string[];
    teaCategory?: string;
    skuId?: string;
    spec?: string;
    packaging?: string;
    priceStatus?: PriceStatus;
    saleChannel?: string;
    evidenceLevel?: string;
  };
  dataSource: "verified-project-source";
};

export type TeaIntent = "product_recommendation" | "product_question" | "product_fit" | "product_compare" | "gift_catalog" | "product_browse" | "product_existence" | "price_query" | "price_reverse_lookup" | "price_compare" | "price_extreme" | "quantity_price_calc" | "brewing_question" | "brand_question" | "aftersales" | "unknown";
export type PriceScope = "all" | "gift_box" | "single_can" | "trial";
export type QuantityPriceStatus = "complete" | "missing_unit_price_or_product" | "missing_budget";
export type TeaEntities = {
  budget?: number;
  scene?: string;
  audience?: string;
  preference?: string;
  teaType?: string;
  packaging?: string;
  packageType?: TeaSku["packageType"];
  netContent?: "共6g" | "60g" | "共150g" | "250g";
  exactWeightGrams?: number;
  maxWeightGrams?: number;
  /** "小一点 / 大一点" 是排序偏好，不是规格硬过滤。 */
  sizePreference?: "small" | "large";
  requiredPackaging?: TeaSku["packaging"];
  excludedPackaging?: TeaSku["packaging"][];
  /** 用户明确要求“推荐一款”等时，限制推荐结果数量；不影响“有哪些”的完整列举。 */
  recommendationLimit?: number;
  productIds?: string[];
  includedProductIds?: string[];
  requiredTeaTypes?: TeaCategory[];
  includedTeaTypes?: TeaCategory[];
  excludedTeaTypes?: TeaCategory[];
  excludedFlavors?: string[];
  excludedIngredients?: string[];
  excludedProductIds?: string[];
  priceAmounts?: number[];
  priceScope?: PriceScope;
  quantity?: number;
  quantityMode?: "exact" | "maximum";
  unitPrice?: number;
  quantityPriceStatus?: QuantityPriceStatus;
};
export type IntentResult = { intent: TeaIntent; entities: TeaEntities };

export type RetrievedProduct = TeaProduct & { relatedSkus: TeaSku[]; score: number; matchReasons: string[] };
export type RetrievedSku = TeaSku & { score: number; matchReasons: string[] };
export type RetrievedPriceEvidence = PriceEvidence & { score: number; matchReasons: string[] };
export type RetrievedKnowledge = KnowledgeDocument & { score: number; matchReasons: string[] };
export type RetrievalResult = { products: RetrievedProduct[]; skus: RetrievedSku[]; prices: RetrievedPriceEvidence[]; knowledge: RetrievedKnowledge[] };

export type ExecutionStep = { label: string; detail?: string; status: "completed" | "empty" | "pending" };
export type TeaResponseMode = "live-rag" | "structured" | "fallback" | "rag-unavailable";
export type TeaRagStatus = "HYBRID_RAG_ACTIVE" | "RAG_UNAVAILABLE" | "PRODUCTION_RAG_CONFIG_ERROR";
export type TeaAnswer = { answer: string; recommendations: RetrievedProduct[]; recommendationSkus?: RetrievedSku[]; sources: RetrievedKnowledge[]; execution: ExecutionStep[]; mode?: TeaResponseMode; ragStatus?: TeaRagStatus; ragError?: string };
export type TeaConversationContext = { priorUserQueries?: string[]; priorAnswers?: TeaAnswer[] };
export type PendingQuantityDialog = {
  intent: "quantity_price_calc";
  slots: { budget?: number; quantity?: number; productId?: string; specification?: string; unitPrice?: number; candidateSkuIds?: string[] };
  missingSlots: Array<"product_or_unit_price" | "sku_specification">;
};
export type TeaConversationState = {
  pendingDialog?: PendingQuantityDialog;
  lastRecommendationQuery?: string;
  lastCandidateSkuIds?: string[];
  /** 仅保存可合并的导购槽位；每轮按 SET / REPLACE / CLEAR / NEGATE 更新。 */
  constraints?: TeaConstraintState;
};
export type TeaConstraintState = {
  budgetMax?: number;
  exactWeight?: number;
  sizePreference?: "small" | "large";
  teaType?: "红茶" | "绿茶";
  includeFlavor?: "桂花";
  excludeTeaType?: "红茶" | "绿茶";
  excludeFlavor?: "桂花";
  packageType?: TeaSku["packageType"] | "礼盒";
  excludePackageType?: "礼盒";
  scenario?: "gifting" | "self" | "trial";
  recipient?: string;
  /** 只有明确说“连龙井原料也不要”时才写入，不能由“不要龙井”推断。 */
  excludeLongjingIngredient?: boolean;
  ingredientRequirement?: string;
  ingredientExclusion?: "龙井";
  requestedCount?: number;
};
export type TeaTurnResult = { answer: TeaAnswer; state: TeaConversationState; intent: TeaIntent };
export type ChatMessage = { id: string; role: "assistant" | "user"; content: string; answer?: TeaAnswer };
