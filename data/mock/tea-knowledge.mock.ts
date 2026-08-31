// Phase 3 原型知识条目，仅用于未来 UI fallback 测试，禁止作为默认知识库来源。
export const mockTeaKnowledge = [
  { id: "mock-product-osmanthus-black-tea", title: "Mock · 桂花红茶产品资料", type: "产品资料", excerpt: "150g / 盒，桂花甜香与温润红茶口感。", keywords: ["桂花红茶", "红茶", "桂花", "规格", "送礼"], dataSource: "mock" },
  { id: "mock-product-spring-longjing", title: "Mock · 明前龙井产品资料", type: "产品资料", excerpt: "100g / 罐，清鲜豆香与鲜爽口感。", keywords: ["龙井", "绿茶", "清香", "冲泡", "规格"], dataSource: "mock" },
  { id: "mock-product-gift-box", title: "Mock · 春山礼盒产品资料", type: "产品资料", excerpt: "488元组合礼盒。", keywords: ["礼盒", "送礼", "长辈", "预算"], dataSource: "mock" },
  { id: "mock-guide-green-tea-brewing", title: "Mock · 绿茶冲泡指南", type: "冲泡指南", excerpt: "绿茶建议使用80–85℃热水。", keywords: ["龙井", "绿茶", "怎么泡", "冲泡"], dataSource: "mock" },
  { id: "mock-guide-red-tea-brewing", title: "Mock · 红茶冲泡指南", type: "冲泡指南", excerpt: "红茶建议使用90–95℃热水。", keywords: ["红茶", "怎么泡", "冲泡"], dataSource: "mock" },
  { id: "mock-guide-gift-selection", title: "Mock · 礼赠选茶指南", type: "选购指南", excerpt: "送礼可结合预算、对象与风味偏好。", keywords: ["送礼", "礼赠", "长辈", "预算", "推荐"], dataSource: "mock" },
] as const;
