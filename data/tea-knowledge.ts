import type { KnowledgeDocument } from "@/types/tea";

export const teaKnowledge: KnowledgeDocument[] = [
  {
    id: "product-osmanthus-black-tea",
    title: "桂花红茶 · 产品资料",
    type: "产品资料",
    excerpt: "150g / 盒，桂花甜香与温润红茶口感，适合日常饮用、轻礼赠送与办公室场景。",
    keywords: ["桂花红茶", "红茶", "桂花", "适合什么人", "规格", "送礼"],
    productId: "osmanthus-black-tea",
  },
  {
    id: "product-spring-longjing",
    title: "明前龙井 · 产品资料",
    type: "产品资料",
    excerpt: "100g / 罐，主打清鲜豆香与鲜爽口感，适合偏好清香型绿茶及商务礼赠场景。",
    keywords: ["龙井", "绿茶", "清香", "冲泡", "规格", "送礼"],
    productId: "spring-longjing",
  },
  {
    id: "product-gift-box",
    title: "春山礼盒 · 产品资料",
    type: "产品资料",
    excerpt: "488 元，组合龙井、桂花红茶与茉莉绿茶，适合预算约 500 元、偏好尚不明确的礼赠需求。",
    keywords: ["礼盒", "送礼", "长辈", "500元", "预算", "清香"],
    productId: "spring-mountain-gift-box",
  },
  {
    id: "guide-green-tea-brewing",
    title: "一叶春山 · 绿茶冲泡指南",
    type: "冲泡指南",
    excerpt: "绿茶建议使用 80–85℃ 热水，避免高温久泡；龙井可使用中投法或上投法。",
    keywords: ["龙井", "绿茶", "怎么泡", "冲泡", "水温", "中投法"],
  },
  {
    id: "guide-red-tea-brewing",
    title: "一叶春山 · 红茶冲泡指南",
    type: "冲泡指南",
    excerpt: "红茶建议使用 90–95℃ 热水，首泡约 3–5 分钟，并按个人口感调整。",
    keywords: ["红茶", "桂花红茶", "怎么泡", "冲泡", "水温"],
  },
  {
    id: "guide-gift-selection",
    title: "一叶春山 · 礼赠选茶指南",
    type: "选购指南",
    excerpt: "送礼时可结合预算、对象与风味偏好；若对方偏好不明确，多茶类组合礼盒可降低选择门槛。",
    keywords: ["送礼", "礼赠", "长辈", "预算", "推荐", "清香"],
  },
];
