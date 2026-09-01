import type { PlannerOutput, TenderDocument } from "@/types/tender-agent";

/**
 * Compatibility-only preview. Execution no longer consumes this list: the Agent
 * selects registered tools at runtime after every observation.
 */
export async function planTenderTasks(document: TenderDocument): Promise<PlannerOutput> {
  const steps: PlannerOutput["steps"] = [{ tool: "parseTenderDocument", reason: "先取得可核验文本。", required: true }];
  if (document.requirements.some((item) => item.category !== "time")) steps.push({ tool: "retrieveCompanyKnowledge", reason: "我方事实先查内部资料。", required: true });
  if (/最新|现行|政策|法规|标准|规范|公开信息|工商信息/.test(document.content)) steps.push({ tool: "webVerify", reason: "仅核验时效性外部事实。", required: false });
  if (document.requirements.some((item) => item.category === "qualification")) steps.push({ tool: "analyzeQualification", reason: "资格条件需要证据审查。", required: true });
  if (document.requirements.some((item) => item.category !== "qualification")) steps.push({ tool: "analyzeTechnicalDeviation", reason: "识别技术和交付偏离。", required: true });
  if (document.scoringRules.length) steps.push({ tool: "analyzeScoring", reason: "对应评分证据。", required: true });
  steps.push({ tool: "generateTechnicalResponse", reason: "仅根据已核验证据起草。", required: true });
  return { mode: "policy-state-machine", steps, rationale: "预览仅用于兼容；实际运行由 DeepSeek Tool Calling 或安全降级状态机逐轮选择。" };
}
