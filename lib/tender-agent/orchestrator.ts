import { sampleTenderContent, sampleTenderName } from "@/data/tender/sample-tender";
import { tenderKnowledge } from "@/data/tender/knowledge";
import { parseTenderDocument } from "@/lib/tender-agent/document";
import { planTenderTasks } from "@/lib/tender-agent/planner";
import { sourceFor, toolRegistry } from "@/lib/tender-agent/tools";
import type { ExecutionStep, RequirementMatch, TenderAgentRequest, TenderAgentResult, TenderDocument, TenderRequirement, TenderRisk, TenderSource, ToolResult } from "@/types/tender-agent";

const labels: Record<ExecutionStep["id"], [string, string]> = {
  parse_tender_document: ["解析招标文件", "识别文本与项目基本信息"], extract_requirements: ["提取结构化需求", "拆分资格、技术、交付、时间与评分要求"], search_company_qualification: ["检索企业资质", "仅查询独立的演示企业资质库"], search_product_capability: ["检索产品能力", "仅查询独立的演示产品能力库"], search_historical_cases: ["检索历史案例", "仅查询独立的演示案例库"], search_external_web: ["检索外部公开信息", "仅预留最新政策与行业标准查询"], check_requirement_match: ["逐条要求匹配", "使用规则引擎计算符合、部分符合、缺失与资料不足"], generate_solution_response: ["生成技术响应建议", "基于已核验的需求、证据与偏离项组织草稿"],
};
const excerpt = (value: string, length = 88) => value.length > length ? `${value.slice(0, length)}…` : value;

function requirementMatch(requirement: TenderRequirement): RequirementMatch {
  const text = requirement.requirement;
  const define = (status: RequirementMatch["status"], risk: RequirementMatch["risk"], capability: string, ids: string[], suggestedAction: string): RequirementMatch => ({ requirementId: requirement.id, requirement: text, category: requirement.category === "qualification" ? "资格条件" : requirement.category === "delivery" ? "交付要求" : "技术要求", status, risk, ourCapability: capability, evidence: sourceFor(tenderKnowledge, ids[0]), suggestedAction, mandatory: requirement.mandatory, scoreWeight: requirement.scoreWeight });
  if (/ISO9001/.test(text)) return define("PASS", "LOW", "已检索到 ISO9001 认证材料（演示）。", ["Q-ISO9001"], "在投标文件中附上对应证明材料，并由人工核验有效期。");
  if (/ISO27001/.test(text)) return define("PASS", "LOW", "已检索到 ISO27001 认证材料（演示）。", ["Q-ISO27001"], "在投标文件中附上对应证明材料，并由人工核验有效期。");
  if (/成立|年限/.test(text)) return define("PASS", "LOW", "演示企业成立于 2018 年，满足三年以上条件。", ["Q-YEAR"], "人工复核营业执照与本项目要求口径。");
  if (/著作权|产品证明/.test(text)) return define("PASS", "LOW", "已检索到知识库与智能问答相关的软件著作权说明（演示）。", ["Q-SOFTCOPY"], "确认可提交的证明材料清单与编号。");
  if (/国产数据库/.test(text)) return define("PARTIAL", "MEDIUM", "部分版本完成适配；特定版本、性能与灾备方案尚需确认。", ["P-DB"], "投标前确认目标数据库版本，补充兼容性和性能证明。");
  if (/医疗.*案例|医疗行业/.test(text)) return define("MISSING", "HIGH", "当前案例库未检索到医疗行业案例。", [], "补充可核验案例证明，或由业务负责人确认是否具备替代响应策略。");
  if (/RAG|来源引用|文档解析|知识库/.test(text)) return define("PASS", "LOW", "支持文档解析、RAG、来源引用与人工转交（演示能力）。", ["P-RAG"], "引用产品能力说明，并由技术人员核验接口和性能边界。");
  if (/私有化|SSO|权限|日志审计/.test(text)) return define("PASS", "LOW", "支持私有化部署、SSO、角色权限与日志审计（演示能力）。", ["P-PRIVATE"], "确认客户身份源、权限模型与审计留存周期。");
  if (/培训|验收|联调|试运行|交付/.test(text)) return define("PASS", "LOW", "可提供部署联调、培训交接与验收支持（演示交付能力）。", ["D-DELIVERY"], "结合项目范围形成正式实施计划。");
  return define("UNKNOWN", "MEDIUM", "现有资料无法确认该项能力。", [], "由售前与技术负责人补充资料或确认响应边界。");
}
function risks(matches: RequirementMatch[]): TenderRisk[] {
  return matches.filter((match) => match.status === "MISSING" || match.status === "PARTIAL" || match.status === "UNKNOWN").map((match) => ({ level: match.risk, title: match.status === "MISSING" ? "关键能力或案例缺失" : match.status === "PARTIAL" ? "能力存在适配边界" : "资料不足，暂不能判断", description: `${match.requirement}：${match.ourCapability}`, relatedRequirementIds: [match.requirementId] }));
}
function solution(matches: RequirementMatch[]) {
  const usable = matches.filter((match) => match.category === "技术要求" || match.category === "交付要求");
  return { outline: ["项目理解与建设目标", "总体技术方案", "关键功能与集成响应", "实施、培训与验收方案", "案例与能力依据", "偏离项与待确认事项"], sections: usable.map((match) => ({ title: `${match.category}｜${match.requirementId}`, tenderRequirement: match.requirement, responseSuggestion: match.status === "PASS" ? `建议响应：我方可围绕“${match.ourCapability}”形成可核验证据与实施说明。` : `建议响应：当前为${match.status === "PARTIAL" ? "部分符合" : match.status === "MISSING" ? "缺失" : "资料不足"}，建议在技术澄清后再写入正式承诺。`, capabilities: match.evidence.map((item) => item.title), cases: /知识库|RAG/.test(match.requirement) ? ["制造行业知识库 POC（Synthetic Demo Data）"] : [], pendingConfirmation: match.status === "PASS" ? ["最终投标承诺、项目范围和证明材料须人工确认。"] : [match.suggestedAction], sources: match.evidence })), };
}
function score(matches: RequirementMatch[]) {
  const weights = { PASS: 1, PARTIAL: 0.5, MISSING: 0, UNKNOWN: 0.25 } as const; const total = matches.length || 1; const value = Math.round(matches.reduce((sum, match) => sum + weights[match.status], 0) / total * 100);
  return { value, formula: "总体匹配度 =（符合×1 + 部分符合×0.5 + 资料不足×0.25 + 缺失×0）÷ 要求总数 × 100；仅用于演示辅助判断，不等同于投标结论。", passed: matches.filter((item) => item.status === "PASS").length, partial: matches.filter((item) => item.status === "PARTIAL").length, missing: matches.filter((item) => item.status === "MISSING").length, unknown: matches.filter((item) => item.status === "UNKNOWN").length };
}
function step(id: ExecutionStep["id"], inputSummary: string, resultSummary: string, sources: TenderSource[] = [], status: ExecutionStep["status"] = "completed", started = Date.now()): ExecutionStep { const [label, purpose] = labels[id]; return { id, label, purpose, inputSummary, resultSummary, sources, status, durationMs: Math.max(1, Date.now() - started) }; }

export async function runTenderAgent(request: TenderAgentRequest): Promise<TenderAgentResult> {
  const name = request.mode === "sample" ? sampleTenderName : request.fileName || "未命名招标文件.txt"; const content = request.mode === "sample" ? sampleTenderContent : request.content || "";
  const started = Date.now(); const document = parseTenderDocument(name, content); const planner = await planTenderTasks(document); const execution: ExecutionStep[] = []; const toolResults: ToolResult[] = [];
  for (const planned of planner.steps) {
    const tick = Date.now();
    if (planned.tool === "parse_tender_document") execution.push(step(planned.tool, `文件：${name}`, `已读取 ${document.content.length} 个字符，识别项目“${document.projectInfo.projectName}”。`, [], "completed", tick));
    else if (planned.tool === "extract_requirements") execution.push(step(planned.tool, "已解析的招标文件文本", `已提取 ${document.requirements.length} 条要求与 ${document.scoringRules.length} 条评分规则。`, document.requirements.map((item) => item.source), "completed", tick));
    else if (planned.tool === "search_company_qualification" || planned.tool === "search_product_capability" || planned.tool === "search_historical_cases" || planned.tool === "search_external_web") { const result = toolRegistry[planned.tool](document.requirements.map((item) => item.requirement).join("\n")); toolResults.push(result); execution.push(step(planned.tool, `检索条件：${document.requirements.length} 条已提取要求`, result.status === "not_configured" ? "Web Search 未配置；不会用外部信息替代内部企业事实。" : `返回 ${result.results.length} 条内部证据。`, result.sources, result.status, tick)); }
    else if (planned.tool === "check_requirement_match") { const matches = document.requirements.map(requirementMatch); execution.push(step(planned.tool, `${matches.length} 条招标要求 + 已返回的内部资料`, `符合 ${matches.filter((item) => item.status === "PASS").length} 条；发现 ${matches.filter((item) => item.status !== "PASS").length} 条需人工处理。`, matches.flatMap((item) => item.evidence), "completed", tick)); }
    else if (planned.tool === "generate_solution_response") execution.push(step(planned.tool, "结构化需求、内部证据与偏离分析", "已生成带待确认项的技术响应建议，不生成最终投标文件。", [], "completed", tick));
  }
  const matches = document.requirements.map(requirementMatch); const matchScore = score(matches); const result = { document, planner, execution, toolResults, matches, matchScore, risks: risks(matches), solution: solution(matches), notice: "Agent 输出仅用于辅助分析。资格、案例、承诺与最终投标决策必须由业务、法务和技术负责人进行人工确认。所有企业资料均为 Synthetic Demo Data。", usedFallback: planner.mode === "rule-fallback" };
  if (!execution.length) throw new Error("planner_failed"); void started; return result;
}
