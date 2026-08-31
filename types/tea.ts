export type TeaCategory = "绿茶" | "调味绿茶" | "红茶" | "调味红茶";
export type DataSource = "verified-project-source" | "mock";
export type PriceStatus = "verified_snapshot" | "unverified";

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
  spec: string;
  netContent: string;
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
  netContent: string;
  packaging: "单罐" | "礼盒";
  amount: number;
  currency: "CNY";
  priceType: "new_customer";
  originalPrice?: number;
  status: "verified_snapshot";
  sourceId: string;
  saleChannel: "微信小店商品截图";
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

export type TeaIntent = "product_recommendation" | "product_question" | "brewing_question" | "gift_recommendation" | "unknown";
export type TeaEntities = { budget?: number; scene?: string; audience?: string; preference?: string; teaType?: string; packaging?: string };
export type IntentResult = { intent: TeaIntent; entities: TeaEntities };

export type RetrievedProduct = TeaProduct & { relatedSkus: TeaSku[]; score: number; matchReasons: string[] };
export type RetrievedSku = TeaSku & { score: number; matchReasons: string[] };
export type RetrievedPriceEvidence = PriceEvidence & { score: number; matchReasons: string[] };
export type RetrievedKnowledge = KnowledgeDocument & { score: number; matchReasons: string[] };
export type RetrievalResult = { products: RetrievedProduct[]; skus: RetrievedSku[]; prices: RetrievedPriceEvidence[]; knowledge: RetrievedKnowledge[] };

export type ExecutionStep = { label: string; detail?: string; status: "completed" | "empty" | "pending" };
export type TeaAnswer = { answer: string; recommendations: RetrievedProduct[]; sources: RetrievedKnowledge[]; execution: ExecutionStep[] };
export type ChatMessage = { id: string; role: "assistant" | "user"; content: string; answer?: TeaAnswer };
