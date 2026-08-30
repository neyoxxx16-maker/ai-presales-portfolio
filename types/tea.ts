export type TeaCategory = "绿茶" | "红茶" | "乌龙茶" | "白茶" | "普洱茶" | "礼盒";

export type TeaProduct = {
  id: string;
  name: string;
  category: TeaCategory;
  price: number;
  spec: string;
  flavor: string;
  suitableFor: string[];
  scene: string[];
  description: string;
  brewing: string;
  keywords: string[];
  source: string;
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  type: "产品资料" | "冲泡指南" | "选购指南";
  excerpt: string;
  keywords: string[];
  productId?: string;
};

export type TeaIntent =
  | "product_recommendation"
  | "product_question"
  | "brewing_question"
  | "gift_recommendation"
  | "unknown";

export type TeaEntities = {
  budget?: number;
  scene?: string;
  audience?: string;
  preference?: string;
  teaType?: string;
};

export type IntentResult = {
  intent: TeaIntent;
  entities: TeaEntities;
};

export type RetrievedProduct = TeaProduct & {
  score: number;
  matchReasons: string[];
};

export type RetrievedKnowledge = KnowledgeDocument & {
  score: number;
  matchReasons: string[];
};

export type RetrievalResult = {
  products: RetrievedProduct[];
  knowledge: RetrievedKnowledge[];
};

export type ExecutionStep = {
  label: string;
  detail?: string;
  status: "completed" | "empty" | "pending";
};

export type TeaAnswer = {
  answer: string;
  recommendations: RetrievedProduct[];
  sources: RetrievedKnowledge[];
  execution: ExecutionStep[];
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  answer?: TeaAnswer;
};
