import type { SourceRecord } from "@/types/tea";

// 来源日期未在 V1.1 语料中明确时保留 null，避免伪造时间信息。
export const teaSources: SourceRecord[] = [
  { sourceId: "S01", sourceName: "《龙井茶产品手册(3).pdf》", sourceType: "产品手册", version: null, sourceDate: null, evidenceLevel: "产品手册" },
  { sourceId: "S02", sourceName: "产品参数 / 冲泡 / 售后长图", sourceType: "产品参数与售后资料", version: null, sourceDate: null, evidenceLevel: "经确认参数图" },
  { sourceId: "S03", sourceName: "微信小店商品截图", sourceType: "销售页面截图", version: null, sourceDate: null, evidenceLevel: "销售页面快照" },
  { sourceId: "S04", sourceName: "包装标签与历史设计稿", sourceType: "包装与历史资料", version: null, sourceDate: null, evidenceLevel: "历史包装资料" },
  { sourceId: "S05", sourceName: "用户补充说明", sourceType: "确认业务口径", version: "V1.1", sourceDate: null, evidenceLevel: "已确认业务口径" },
];
