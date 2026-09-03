import { recordsByCategory } from "@/data/tender/knowledge";
import { randomUUID } from "node:crypto";
import {
  sampleTenderContent,
  sampleTenderName,
} from "@/data/tender/sample-tender";
import { retrieveCompanyEvidence } from "@/lib/tender-agent/company-retriever";
import { parseTenderDocument } from "@/lib/tender-agent/document";
import { externalSearch, tavilyConfigured } from "@/lib/tender-agent/external-verification";
import { parseBidDocument } from "@/lib/tender-agent/file-parser";
import { ocrDocument } from "@/lib/tender-agent/ocr";
import { searchCompanyEvidence } from "@/lib/tender-agent/tools";
import type {
  AnalysisSummary,
  EvidenceConflict,
  ExecutionStep,
  KnowledgeRecord,
  MatchStatus,
  ParsedBidDocument,
  PresalesStrategyAnalysis,
  RequirementMatch,
  ScoringAnalysis,
  TenderAgentRequest,
  TenderAgentResult,
  TaskCompletion,
  TenderRequirement,
  TenderRisk,
  TenderSource,
  TenderToolName,
  ToolResult,
} from "@/types/tender-agent";

const labels: Record<TenderToolName, [string, string]> = {
  parseTenderDocument: ["招标解析", "读取文件并识别项目、需求和评分章节"],
  ocrDocument: ["OCR", "仅对无法获得可靠文本的扫描件识别文字"],
  retrieveCompanyKnowledge: [
    "企业知识库 Hybrid RAG",
    "优先检索我方可追溯企业资料",
  ],
  webVerify: ["Tavily 外部核验", "核验最新政策、公开标准及其他时效性外部事实"],
  analyzeQualification: ["资格审查", "基于内部原始证据逐条判断资格条件"],
  analyzeTechnicalDeviation: [
    "技术偏离分析",
    "基于内部原始证据识别技术、商务、交付和服务偏离",
  ],
  analyzeScoring: ["评分项分析", "将评分要求与已核验证据对应"],
  generateTechnicalResponse: ["技术应答草稿", "只使用已检索证据生成可复核草稿"],
  finalBidRecommendation: [
    "综合投标判断",
    "汇总资格、技术、评分与证据缺口，形成最终投标建议",
  ],
};
const today = () => new Date().toISOString().slice(0, 10);
const isCurrent = (record: KnowledgeRecord) =>
  record.status === "valid" && (!record.validTo || record.validTo >= today());
const riskFor = (status: MatchStatus) =>
  status === "PASS" ? "LOW" : status === "FAIL" || status === "MISSING_EVIDENCE" ? "HIGH" : "MEDIUM";
const categoryLabel = (category: TenderRequirement["category"]) =>
  ({
    qualification: "资格审查",
    technical: "技术偏离",
    business: "商务要求",
    delivery: "实施交付",
    "after-sales": "售后服务",
    time: "时间要求",
  })[category];
const action = (status: MatchStatus) =>
  status === "PASS"
    ? "投标前复核原始证明材料、有效期与适用范围。"
    : status === "FAIL"
      ? "存在已知事实冲突，不宜作符合承诺；请确认是否具备可替代方案。"
      : "补充可核验材料后再形成正式承诺。";

/** Only a directly comparable, sourced fact may produce FAIL. */
function knownConflict(requirement: TenderRequirement, evidence: KnowledgeRecord[]) {
  const minimum = requirement.requirement.match(/注册资本[^\d]*(\d+(?:\.\d+)?)\s*万/);
  if (!minimum) return false;
  const known = evidence
    .map((item) => item.content.match(/注册资本[^\d]*(\d+(?:\.\d+)?)\s*万/))
    .find((item) => item?.[1]);
  return Boolean(known && Number(known[1]) < Number(minimum[1]));
}

function makeMatch(
  requirement: TenderRequirement,
  status: MatchStatus,
  reason: string,
  evidence: KnowledgeRecord[],
): RequirementMatch {
  const sources = [requirement.source, ...evidence.map((item) => item.source)];
  return {
    requirementId: requirement.id,
    requirement: requirement.requirement,
    category: categoryLabel(requirement.category),
    status,
    risk: riskFor(status),
    ourCapability: evidence.length
      ? evidence.map((item) => item.title).join("；")
      : "待确认：未检索到可核验证据。",
    reason,
    evidenceIds: evidence.map((item) => item.evidenceId),
    sourceFiles: Array.from(new Set(evidence.map((item) => item.sourceFile))),
    // Every judgment keeps the original tender clause first, followed by company evidence.
    evidence: sources,
    suggestedAction: action(status),
    mandatory: requirement.mandatory,
    scoreWeight: requirement.scoreWeight,
  };
}
function demoMatch(requirement: TenderRequirement): RequirementMatch {
  const query = requirement.requirement;
  if (/项目经理/.test(query)) {
    const people = recordsByCategory("personnel").filter((item) =>
      item.content.includes("项目经理"),
    );
    const valid = /信息系统项目管理师/.test(query)
      ? people.filter((item) => item.content.includes("信息系统项目管理师"))
      : people.filter(isCurrent);
    return makeMatch(
      requirement,
      valid.length ? "PASS" : "MISSING_EVIDENCE",
      valid.length
        ? "已检索到项目经理有效证明。"
        : "待确认：未检索到满足该证书条件的项目经理证明。",
      people,
    );
  }
  const evidence = searchCompanyEvidence(query);
  const valid = evidence.filter(isCurrent);
  const partial = evidence.filter((item) => item.status === "partial");
  const invalid = evidence.filter(
    (item) => item.status === "expired" || item.status === "missing",
  );
  if (/成立|年限/.test(query)) {
    const company = evidence.find((item) => item.category === "company");
    const year = company?.content.match(/成立于\s*(\d{4})-/)?.[1];
    const enough = year && Number(today().slice(0, 4)) - Number(year) >= 3;
    return makeMatch(
      requirement,
      enough ? "PASS" : "MISSING_EVIDENCE",
      enough
        ? `企业主体资料显示成立于 ${year} 年。`
        : "待确认：未检索到可确认成立年限的主体资料。",
      company ? [company] : [],
    );
  }
  if (knownConflict(requirement, valid))
    return makeMatch(
      requirement,
      "FAIL",
      "已检索到的企业事实与招标要求存在明确数值冲突。",
      valid,
    );
  if (valid.length)
    return makeMatch(
      requirement,
      "PASS",
      `检索到 ${valid.length} 条有效内部证据。`,
      valid,
    );
  if (partial.length)
    return makeMatch(
      requirement,
      "PENDING",
      "待确认：检索到相关证据，但适用范围或有效期需人工核验。",
      partial,
    );
  if (invalid.length)
    return makeMatch(
      requirement,
      "MISSING_EVIDENCE",
      "未找到可用于证明符合的有效材料；已失效或明确缺失资料不能作为符合依据。",
      invalid,
    );
  return makeMatch(
    requirement,
    "MISSING_EVIDENCE",
    "未找到可用于证明符合的内部材料；资料缺失不等于企业不具备该能力。",
    [],
  );
}
function workspaceRecord(
  item: Awaited<ReturnType<typeof retrieveCompanyEvidence>>["results"][number],
): KnowledgeRecord {
  const category = (
    {
      company: "company",
      qualification: "qualification",
      personnel: "personnel",
      case: "case",
      product: "product",
      capability: "product",
      delivery: "delivery",
      "after-sales": "after-sales",
      other: "policy",
    } as const
  )[item.category];
  const status =
    item.validation === "EXPIRED"
      ? "expired"
      : item.validation === "VALID"
        ? "valid"
        : "partial";
  return {
    evidenceId: item.evidenceId,
    id: item.evidenceId,
    category,
    title: item.sourceFile,
    content: item.content,
    tags: [],
    sourceFile: item.sourceFile,
    status,
    validFrom: item.validFrom,
    validTo: item.validTo,
    synthetic: false,
    source: {
      id: item.evidenceId,
      title: `${item.sourceFile} · ${item.sectionTitle}`,
      excerpt: item.content.slice(0, 160),
      quote: item.content.slice(0, 160),
      sourceFile: item.sourceFile,
      pageNumber: item.pageNumber ?? item.page,
      location: `本地资料库 · ${item.sectionTitle}${item.page ? ` · 第 ${item.page} 页` : ""}`,
      category: "真实企业资料",
      documentName: item.sourceFile,
      chunkId: item.chunkId,
      page: item.pageNumber ?? item.page,
      score: item.score,
      retrievalMethod: item.retrievalMethod,
    },
  };
}
async function workspaceMatch(
  requirement: TenderRequirement,
): Promise<RequirementMatch> {
  const retrieved = await retrieveCompanyEvidence(requirement.requirement, {
    topK: 8,
  });
  const evidence = retrieved.results.map(workspaceRecord);
  const valid = evidence.filter(isCurrent);
  const expired = evidence.filter((item) => item.status === "expired");
  if (knownConflict(requirement, valid))
    return makeMatch(
      requirement,
      "FAIL",
      "已检索到的企业事实与招标要求存在明确数值冲突。",
      valid,
    );
  if (valid.length)
    return makeMatch(
      requirement,
      "PASS",
      `已从真实企业资料库检索到 ${valid.length} 条有效证据（${retrieved.results[0]?.retrievalMethod ?? "KEYWORD"}）。`,
      valid,
    );
  if (expired.length)
    return makeMatch(
      requirement,
      "MISSING_EVIDENCE",
      "未找到有效证明材料；已过期资料不能作为符合依据。",
      expired,
    );
  if (evidence.length)
    return makeMatch(
      requirement,
      "PENDING",
      "待确认：检索到相关企业资料，但主体一致性、适用范围或有效期仍需人工核验。",
      evidence,
    );
  return makeMatch(
    requirement,
    "MISSING_EVIDENCE",
    "未找到可用于证明符合的真实企业材料；资料缺失不等于企业不具备该能力。",
    [],
  );
}
function summary(
  matches: RequirementMatch[],
  analyzed: boolean,
): AnalysisSummary {
  const total = matches.length || 1;
  const passCount = matches.filter((item) => item.status === "PASS").length;
  const pendingCount = matches.filter((item) => item.status === "PENDING").length;
  const missingEvidenceCount = matches.filter(
    (item) => item.status === "MISSING_EVIDENCE",
  ).length;
  const failCount = matches.filter((item) => item.status === "FAIL").length;
  const highRiskCount = matches.filter((item) => item.risk === "HIGH").length;
  const evidenceCoverage = Math.round(
    (matches.filter((item) => item.evidenceIds.length > 0).length / total) *
      100,
  );
  const readinessScore = Math.max(
    0,
    Math.round(
      ((passCount + pendingCount * 0.5) / total) * 100 -
        Math.min(15, highRiskCount * 3),
    ),
  );
  return {
    analyzed,
    totalRequirements: matches.length,
    passCount,
    pendingCount,
    missingEvidenceCount,
    failCount,
    highRiskCount,
    manualReviewCount: matches.filter((item) => item.status !== "PASS").length,
    evidenceCoverage,
    readinessScore,
    readinessFormula:
      "应标准备度 =（符合×1 + 待确认×0.5）÷ 可判断要求总数 ×100；资料缺失与明确不符合均不计分，仅表示当前材料准备情况，不代表最终中标概率。",
    recommendation: tenderRecommendation(matches, analyzed),
  };
}
export function tenderRecommendation(matches: RequirementMatch[], analyzed = true) {
  if (!analyzed || !matches.length) return "暂缓决策";
  if (matches.some((item) => item.mandatory && item.status === "FAIL")) return "不建议投";
  const core = matches.filter((item) => item.mandatory && ["资格审查", "技术偏离"].includes(item.category));
  const confirmedCore = core.filter((item) => item.status === "PASS" || (item.status === "PENDING" && item.evidenceIds.length > 0));
  const confirmedCapability = matches.some((item) => item.status === "PASS" && ["技术偏离", "实施交付", "商务要求"].includes(item.category));
  if (core.length && !confirmedCore.length && !confirmedCapability) return "暂缓决策";
  return matches.some((item) => item.status !== "PASS") ? "有条件可投" : "可投";
}
function risks(matches: RequirementMatch[]): TenderRisk[] {
  return matches
    .filter((match) => match.status !== "PASS")
    .map((match) => ({
      level: match.risk,
      title: "待确认或证据缺口",
      description: `${match.requirement}：${match.reason}`,
      relatedRequirementIds: [match.requirementId],
    }));
}
function solution(matches: RequirementMatch[]) {
  const usable = matches.filter((match) =>
    ["技术偏离", "商务要求", "实施交付", "售后服务"].includes(match.category),
  );
  return {
    outline: ["项目理解", "技术方案", "实施与验收", "偏离项与待确认事项"],
    sections: usable.map((match) => ({
      title: `${match.requirementId}｜${match.category}`,
      tenderRequirement: match.requirement,
      responseStatus: match.status,
      responseSuggestion:
        match.status === "PASS"
          ? `根据已检索的内部证据，可围绕“${match.requirement}”形成技术响应；正式承诺须复核原件和项目边界。`
          : `待确认：${match.reason} 未补齐证据前不得作完整承诺。`,
      capabilities: [],
      cases: [],
      pendingConfirmation:
        match.status === "PASS"
          ? ["复核原始证明材料与项目适用范围。"]
          : [match.suggestedAction],
      sources: match.evidence,
    })),
  };
}
const number = (value: string) =>
  Number(value.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
function scoring(
  rules: TenderAgentResult["document"]["scoringRules"],
  matches: RequirementMatch[],
): ScoringAnalysis[] {
  return rules.map((rule, index) => {
    const match =
      matches.find(
        (item) =>
          /项目经理/.test(rule.description) &&
          /项目经理/.test(item.requirement),
      ) ??
      matches.find(
        (item) =>
          /案例|业绩/.test(rule.description) &&
          /案例|业绩/.test(item.requirement),
      );
    const max = number(rule.score);
    const subjective = /综合|酌情|合理性|完整性|先进性|方案/.test(rule.description);
    const factor = match?.status === "PASS" ? 1 : match?.status === "PENDING" ? 0.5 : 0;
    const estimated = !max
      ? "暂无法估算"
      : !match || match.status === "MISSING_EVIDENCE" || match.status === "FAIL"
        ? "暂无法估算"
        : subjective
          ? `${Math.max(0, Math.round(max * (factor || 0.65) * 0.7))}–${Math.round(max * (factor || 0.85))} / ${max}`
          : `${Math.round(max * factor * 10) / 10} / ${max}`;
    return {
      id: `S${String(index + 1).padStart(2, "0")}`,
      category: rule.category,
      item: rule.category,
      maxScore: rule.score,
      scoringRules: [rule.description],
      bidEvidence: [rule.source],
      companyEvidence: match?.evidence ?? [],
      estimatedScore: estimated,
      estimatedScoreMin: subjective && max ? Math.max(0, Math.round(max * (factor || 0.65) * 0.7)) : undefined,
      estimatedScoreMax: subjective && max ? Math.round(max * (factor || 0.85)) : undefined,
      confidence: match?.status === "PASS" && !subjective ? "high" : match ? "medium" : "low",
      status: match?.status ?? "MISSING_EVIDENCE",
      risk: match?.risk ?? "MEDIUM",
      reason: match?.reason ?? "未找到评分条件对应的企业证明材料。",
      manualReviewRequired: subjective || !match || match.status !== "PASS",
    };
  });
}
function scoringDimension(value: string) {
  if (/案例|业绩/.test(value)) return "历史案例与业绩";
  if (/资质|认证|证书/.test(value)) return "企业资质";
  if (/服务|售后|SLA/.test(value)) return "服务能力";
  if (/实施|交付|项目经理/.test(value)) return "实施方案与团队";
  if (/价格|报价/.test(value)) return "报价策略";
  if (/演示|POC|答辩/.test(value)) return "演示 / POC / 答辩";
  return /参数|技术|方案/.test(value) ? "技术参数与方案" : "评分规则要求";
}
function competitorStrategy(dimension: string) {
  return `成熟竞品可能围绕${dimension}补齐高分材料并强化可验证成果。`;
}
function radarCategory(requirement: RequirementMatch) {
  const text = `${requirement.category} ${requirement.requirement}`;
  if (/废标|无效投标|否决/.test(text)) return "废标 / 一票否决风险";
  if (/资格|资质|认证|证书/.test(text)) return "资格条件风险";
  if (/案例|业绩/.test(text)) return "案例 / 业绩不足";
  if (/付款|回款/.test(text)) return "付款条件风险";
  if (/保证金|履约/.test(text)) return "保证金 / 履约要求";
  if (/合同|违约|赔偿|责任/.test(text)) return "合同责任风险";
  if (/验收/.test(text)) return "验收条件风险";
  if (/SLA|响应|售后/.test(text)) return "售后 SLA 风险";
  if (/交付|实施|工期|周期/.test(text)) return "交付周期风险";
  if (/商务|价格|报价/.test(text)) return "商务条件风险";
  return requirement.category === "技术偏离" ? "技术参数风险" : `${requirement.category}风险`;
}
function controlRiskAnalysis(
  document: TenderAgentResult["document"],
): PresalesStrategyAnalysis["controlRiskAnalysis"] {
  const clauses = [
    ...document.requirements.map((item) => ({ clause: item.requirement, source: item.source })),
    ...document.scoringRules.map((item) => ({ clause: item.description, source: item.source })),
  ];
  const suspiciousClauses = clauses.flatMap(({ clause, source }) => {
    const categories: Array<{ category: string; reason: string; high?: boolean }> = [];
    if (/指定品牌|指定厂商|仅限.{0,16}(?:品牌|厂商|产品|服务)|华为|阿里云|腾讯云|深信服|H3C|思科/.test(clause))
      categories.push({ category: "特定品牌或厂商指向", reason: "条款出现特定品牌、厂商或限定采购对象，需核验是否允许等效替代。", high: true });
    if (/唯一|独有|专利|私有协议|指定接口|排他|不得替代|仅支持/.test(clause))
      categories.push({ category: "排他性技术要求", reason: "条款含唯一、私有或排他性表述，可能压缩等效方案的竞争空间。", high: true });
    if (/(?:案例|业绩).{0,24}(?:[5-9]|\d{2,})\s*(?:个|项)|(?:[5-9]|\d{2,})\s*(?:个|项).{0,24}(?:案例|业绩)/.test(clause))
      categories.push({ category: "异常高案例门槛", reason: "较高的案例数量门槛可能提高新进入者参与难度，需结合项目规模核验必要性。" });
    if (/CMMI\s*[45]|多项.{0,20}(?:认证|资质)|同时具备.{0,30}(?:认证|资质)/i.test(clause))
      categories.push({ category: "资质组合门槛", reason: "多项或高等级资质组合可能形成较高准入门槛，需核验与项目需求的关联度。" });
    if (/本地|属地|注册地|本市|本省|当地/.test(clause))
      categories.push({ category: "地域限制", reason: "条款含地域或属地限定，建议核验是否存在可接受的服务响应替代证明。" });
    if (/精度|误差|≤|±|兼容.{0,20}(?:生态|平台)/.test(clause))
      categories.push({ category: "窄参数或生态依赖", reason: "参数精度或兼容生态要求可能形成倾向性组合，建议开展等价技术证明。" });
    return categories.map((item) => ({
      clause,
      category: item.category,
      riskLevel: item.high ? "high" as const : "medium" as const,
      reason: `疑似倾向性：${item.reason}`,
      evidence: [source],
      possibleImpact: "可能增加响应、授权或等价证明成本；不代表已构成违法控标。",
      responseStrategy: "准备技术等价证明，梳理偏离点，并在投标前通过澄清或质疑程序核验。",
      confidence: "medium" as const,
    }));
  });
  const overallRisk = suspiciousClauses.some((item) => item.riskLevel === "high") ? "high" : suspiciousClauses.length ? "medium" : "low";
  return {
    overallRisk,
    summary: suspiciousClauses.length
      ? "以下为基于原始条款的倾向性风险识别，均为疑似风险，不构成违法控标结论。"
      : "未发现可由当前文本直接支持的明显倾向性组合；仍建议人工复核关键参数。",
    suspiciousClauses,
    recommendations: suspiciousClauses.length
      ? ["核验等效替代空间与条款必要性。", "提前准备兼容、授权或技术等价证明。"]
      : ["保留原始条款与参数响应矩阵，投标前完成合规复核。"],
  };
}
function presalesStrategyAnalysis(
  document: TenderAgentResult["document"],
  matches: RequirementMatch[],
  scoringAnalysis: ScoringAnalysis[],
): PresalesStrategyAnalysis {
  const controlRisk = controlRiskAnalysis(document);
  const likelyCompetitionAreas = scoringAnalysis.map((item) => {
    const dimension = scoringDimension(`${item.item} ${item.scoringRules.join(" ")}`);
    return {
      dimension,
      scoreWeight: item.maxScore,
      competitorLikelyStrategy: competitorStrategy(dimension),
      ourCurrentPosition: item.status === "PASS" ? "已有可核验证据，仍需复核适用范围。" : "资料未提供 / 待确认，不应默认满足。",
      evidence: [...item.bidEvidence, ...item.companyEvidence],
      confidence: item.confidence,
    };
  });
  const actions = scoringAnalysis.map((item) => {
    const available = number(item.maxScore);
    const priority = item.status === "PASS" && available >= 3
      ? "must_win" as const
      : item.status === "PENDING"
        ? "fight_for" as const
        : available <= 3
          ? "low_priority" as const
          : "difficult" as const;
    const gap = item.status === "PASS" ? "证据已覆盖，需复核原件、有效期和适用范围。" : item.reason;
    return {
      priority,
      scoreItem: item.item,
      availableScore: item.maxScore,
      currentStatus: item.status,
      gap,
      recommendedAction: priority === "must_win"
        ? "列入投标前必检清单，确保每份证明材料与评分条款一一对应。"
        : priority === "fight_for"
          ? "优先补齐可核验证据，并突出行业相似度、实施成果或交付能力。"
          : priority === "low_priority"
            ? "评估办理周期与成本后再投入，避免挤占高分关键项资源。"
            : "当前缺口较大，评估是否存在可验证替代材料；无依据时不承诺得分。",
      evidence: [...item.bidEvidence, ...item.companyEvidence],
    };
  });
  const totalAvailableScore = scoringAnalysis.reduce((total, item) => total + number(item.maxScore), 0);
  const confirmedScore = scoringAnalysis.filter((item) => item.status === "PASS" && !item.manualReviewRequired).reduce((total, item) => total + number(item.maxScore), 0);
  const potentialScore = scoringAnalysis.filter((item) => item.status === "PENDING").reduce((total, item) => total + number(item.maxScore), 0);
  const baseRisks = matches.filter((item) => item.status !== "PASS").map((item) => {
    const severity = item.mandatory && (item.status === "FAIL" || item.status === "MISSING_EVIDENCE")
      ? "critical" as const
      : item.risk === "HIGH" ? "high" as const : item.risk === "MEDIUM" ? "medium" as const : "low" as const;
    return {
      title: severity === "critical" ? "可能直接废标或资格失效" : radarCategory(item),
      category: radarCategory(item),
      severity,
      clause: item.requirement,
      reason: item.reason,
      consequence: severity === "critical" ? "可能导致资格不通过或直接废标。" : "可能影响响应完整性、评分或交付承诺。",
      recommendation: item.suggestedAction,
      evidence: item.evidence,
      status: item.status === "FAIL" ? "confirmed" as const : "needs_confirmation" as const,
    };
  });
  const controlRisks = controlRisk.suspiciousClauses.map((item) => ({
    title: "倾向性 / 排他风险",
    category: item.category,
    severity: item.riskLevel === "high" ? "high" as const : "medium" as const,
    clause: item.clause,
    reason: item.reason,
    consequence: item.possibleImpact,
    recommendation: item.responseStrategy,
    evidence: item.evidence,
    status: "suspected" as const,
  }));
  const scoreRisks = actions.filter((item) => item.priority === "difficult" || item.priority === "fight_for").map((item) => ({
    title: "评分失分风险",
    category: "评分标准",
    severity: item.priority === "difficult" ? "high" as const : "medium" as const,
    clause: item.scoreItem,
    reason: item.gap,
    consequence: `可能损失 ${item.availableScore} 对应的可争取分。`,
    recommendation: item.recommendedAction,
    evidence: item.evidence,
    status: "needs_confirmation" as const,
  }));
  const radarRisks = [...baseRisks, ...controlRisks, ...scoreRisks].sort((left, right) => ({ critical: 0, high: 1, medium: 2, low: 3 })[left.severity] - ({ critical: 0, high: 1, medium: 2, low: 3 })[right.severity]);
  const criticalCount = radarRisks.filter((item) => item.severity === "critical").length;
  const highCount = radarRisks.filter((item) => item.severity === "high").length;
  const mediumCount = radarRisks.filter((item) => item.severity === "medium").length;
  const conclusionSources = [...likelyCompetitionAreas.flatMap((item) => item.evidence), ...radarRisks.flatMap((item) => item.evidence)];
  const evidenceCoverage = Math.round((conclusionSources.length ? conclusionSources.filter((item) => item.quote || item.excerpt).length / conclusionSources.length : 1) * 100);
  const uncertaintyTargets = [...matches.filter((item) => item.status !== "PASS"), ...scoringAnalysis.filter((item) => item.status !== "PASS")];
  const uncertaintyHandling = Math.round((uncertaintyTargets.length ? uncertaintyTargets.filter((item) => /待确认|资料|未找到|不宜/.test(item.reason)).length / uncertaintyTargets.length : 1) * 100);
  const unsupportedClaims = radarRisks.filter((item) => ["critical", "high"].includes(item.severity) && !item.evidence.length).length;
  const completeness = document.scoringRules.length || matches.length ? 100 : 50;
  const overallQuality = unsupportedClaims > 0 || evidenceCoverage < 60 ? "D" : evidenceCoverage >= 85 && uncertaintyHandling >= 85 && completeness === 100 ? "A" : evidenceCoverage >= 70 ? "B" : "C";
  return {
    competitorAnalysis: {
      mode: "score_based_simulation",
      summary: likelyCompetitionAreas.length ? "基于评分规则的竞品策略推演；未识别真实竞品名单，不生成具体公司名称。" : "当前未解析到结构化评分规则，暂不推演具体竞品得分策略。",
      likelyCompetitionAreas,
      differentiationStrategies: actions.filter((item) => item.priority !== "low_priority").map((item) => ({
        strategy: `围绕“${item.scoreItem}”形成可验证差异化材料。`,
        targetScoreItem: item.scoreItem,
        reason: item.gap,
        expectedBenefit: `提升该项 ${item.availableScore} 的可争取空间，不预测最终得分。`,
        action: item.recommendedAction,
        evidence: item.evidence,
      })),
      evidence: likelyCompetitionAreas.flatMap((item) => item.evidence),
    },
    controlRiskAnalysis: controlRisk,
    scoreSprint: {
      totalAvailableScore,
      confirmedScore,
      potentialScore,
      summary: actions.length ? "按证据覆盖、分值和补齐难度分层；可确认分不等于最终评审得分。" : "未解析到可用评分项，暂不生成分值预测。",
      mustWin: actions.filter((item) => item.priority === "must_win").map((item) => item.scoreItem),
      fightFor: actions.filter((item) => item.priority === "fight_for").map((item) => item.scoreItem),
      lowPriority: actions.filter((item) => item.priority === "low_priority").map((item) => item.scoreItem),
      difficultOrGiveUp: actions.filter((item) => item.priority === "difficult").map((item) => item.scoreItem),
      actions,
    },
    riskRadar: {
      overallRisk: criticalCount || highCount ? "high" : mediumCount ? "medium" : "low",
      criticalCount,
      highCount,
      mediumCount,
      risks: radarRisks,
    },
    evaluation: { evidenceCoverage, completeness, uncertaintyHandling, unsupportedClaims, overallQuality },
  };
}

type State = {
  runId: string;
  request: TenderAgentRequest;
  name: string;
  rawFiles: File[];
  parsedFiles: ParsedBidDocument[];
  parsed?: ParsedBidDocument;
  document?: TenderAgentResult["document"];
  execution: ExecutionStep[];
  toolResults: ToolResult[];
  matches: Map<string, RequirementMatch>;
  externalVerification: TenderAgentResult["externalVerification"];
  solution?: TenderAgentResult["solution"];
  finalAnswer?: string;
  finalAnswerStatus: TenderAgentResult["finalAnswerStatus"];
  finalAnswerError?: string;
  scoringAnalysis?: ScoringAnalysis[];
  deepSeekToolCalls: number;
  currentDecisionSource: "llm" | "rule" | "fallback";
  lastDecisionError?: string;
};
const hasCurrentExternalNeed = (
  document: TenderAgentResult["document"],
  task = "",
) =>
  /最新|现行|当前|政策|法规|标准|规范|公开信息|工商信息/.test(
    `${task}\n${document.content}`,
  );
const hasInternalKnowledgeNeed = (
  document: TenderAgentResult["document"],
  task = "",
) =>
  document.requirements.some((item) => item.category !== "time") ||
  /我方|我司|资质|案例|业绩|人员|产品参数|服务能力|能力/.test(task);
function callReason(state: State, id: TenderToolName) {
  if (id === "parseTenderDocument") return "需要先获取可核验的招标文本。";
  if (id === "ocrDocument")
    return "普通解析未获得可靠文本，文件被识别为扫描件。";
  if (id === "retrieveCompanyKnowledge")
    return "任务涉及我方资质、案例、人员或能力，优先使用内部可信资料。";
  if (id === "webVerify")
    return "任务涉及最新政策、公开标准或时效性外部事实，内部资料不能保证其时效性。";
  if (id === "analyzeQualification")
    return "已取得招标资格条件和内部证据，需要逐条审查。";
  if (id === "analyzeTechnicalDeviation")
    return "已取得技术/商务/交付要求和内部证据，需要识别偏离与待确认项。";
  if (id === "analyzeScoring")
    return "招标文件含评分规则，需要基于已核验证据做辅助分析。";
  if (id === "finalBidRecommendation")
    return "已汇总资格、技术、评分与证据缺口，需要形成明确的投标建议。";
  return state.matches.size
    ? "已有证据与逐条分析结论，可以生成受证据约束的技术应答草稿。"
    : "缺少足够证据，生成结果将明确标记待确认。";
}
function step(
  state: State,
  id: TenderToolName,
  inputSummary: string,
  resultSummary: string,
  sources: TenderSource[],
  status: ExecutionStep["status"],
  started: number,
  options: Pick<
    ExecutionStep["trace"],
    "provider" | "retrievalMethod" | "fallback" | "error"
  > = {},
): ExecutionStep {
  const [label, purpose] = labels[id];
  const traceStatus =
    status === "completed"
      ? "success"
      : status === "skipped"
        ? "skipped"
      : status === "not_configured"
        ? "fallback"
        : "failed";
  return {
    id,
    label,
    purpose,
    reason: callReason(state, id),
    inputSummary,
    resultSummary,
    sources,
    status,
    durationMs: Math.max(1, Date.now() - started),
    trace: {
      runId: state.runId,
      stepId: `${state.runId}-${state.execution.length + 1}`,
      timestamp: new Date().toISOString(),
      type: "tool",
      tool: id,
      status: traceStatus,
      decisionSource: state.currentDecisionSource,
      sourceCount: sources.length,
      observation: resultSummary,
      ...options,
      fallback:
        options.fallback ??
        (state.currentDecisionSource === "fallback"
          ? "模型决策未成功，已使用规则降级。"
          : undefined),
      error:
        options.error ??
        (state.currentDecisionSource === "fallback"
          ? state.lastDecisionError
          : undefined),
    },
  };
}
function allMatches(state: State) {
  return (
    state.document?.requirements
      .map((item) => state.matches.get(item.id))
      .filter((item): item is RequirementMatch => Boolean(item)) ?? []
  );
}
export function detectEvidenceConflicts(
  matches: RequirementMatch[],
  external: TenderAgentResult["externalVerification"],
): EvidenceConflict[] {
  const official = external.results.filter((item) =>
    /\.gov\.cn$|\.org\.cn$/.test(item.domain),
  );
  return matches.flatMap((match) => {
    const tokens = Array.from(
      new Set(
        match.requirement.match(/[A-Z]{2,}\d*|[\u4e00-\u9fa5]{3,}/g) ?? [],
      ),
    ).filter((token) => token.length >= 3);
    const conflicting = official.filter(
      (item) =>
        /失效|撤销|无效|不具备|不存在/.test(`${item.title} ${item.snippet}`) &&
        tokens.some((token) => `${item.title} ${item.snippet}`.includes(token)),
    );
    if (!match.evidence.length || !conflicting.length) return [];
    return [
      {
        requirementId: match.requirementId,
        requirement: match.requirement,
        internalSources: match.evidence,
        externalSources: conflicting.map((item, index) => ({
          id: `WEB-CONFLICT-${index}`,
          title: item.title,
          excerpt: item.snippet.slice(0, 160),
          location: item.url,
          category: "外部公开信息",
        })),
        judgment:
          "发现内部资料与官方外部资料可能冲突；可能存在资料过期或适用范围变化，请人工核验原件与官方登记信息。",
      },
    ];
  });
}
function allowedPolicyTools(state: State): TenderToolName[] {
  if (state.parsedFiles.some((item) => item.status === "OCR_REQUIRED"))
    return ["ocrDocument"];
  if (!state.document) return ["parseTenderDocument"];
  const requirements = state.document.requirements;
  const ran = (id: TenderToolName) =>
    state.execution.some((item) => item.id === id);
  const task = state.request.task?.trim() || "分析招标文件并形成技术应答";
  const defaultAnalysis = !state.request.task?.trim();
  const wantsQualification =
    defaultAnalysis ||
    /能不能投|能否投|能投|是否满足|资格|资质|人员|业绩|案例/.test(task);
  const wantsTechnical =
    defaultAnalysis ||
    /能不能投|能否投|能投|是否满足|技术|偏离|参数|方案|应答|分析/.test(task);
  const wantsScoring = defaultAnalysis || /评分|分数|得分/.test(task);
  const wantsResponse =
    defaultAnalysis ||
    /能不能投|能否投|能投|是否满足|技术|方案|应答|分析|投标/.test(task);
  const wantsInternal =
    wantsQualification ||
    wantsTechnical ||
    /我方|我司|我公司|我们公司|案例|人员|资质|产品|服务能力/.test(task);
  const wantsExternal =
    /最新|现行|当前|政策|法规|标准|规范|公开信息|工商信息/.test(task) ||
    (defaultAnalysis && hasCurrentExternalNeed(state.document));
  const pending: TenderToolName[] = [];
  if (wantsInternal && !ran("retrieveCompanyKnowledge"))
    pending.push("retrieveCompanyKnowledge");
  if (wantsExternal && !ran("webVerify")) pending.push("webVerify");
  if (
    wantsQualification &&
    requirements.some((item) => item.category === "qualification") &&
    !ran("analyzeQualification")
  )
    pending.push("analyzeQualification");
  if (
    wantsTechnical &&
    requirements.some((item) =>
      ["technical", "business", "delivery", "after-sales", "time"].includes(
        item.category,
      ),
    ) &&
    !ran("analyzeTechnicalDeviation")
  )
    pending.push("analyzeTechnicalDeviation");
  if (wantsScoring && !ran("analyzeScoring"))
    pending.push("analyzeScoring");
  if (pending.length) return pending;
  if (wantsResponse && !ran("generateTechnicalResponse"))
    return ["generateTechnicalResponse"];
  return defaultAnalysis && !ran("finalBidRecommendation")
    ? ["finalBidRecommendation"]
    : [];
}
/** OpenAI-compatible tool schema sent to DeepSeek on every Agent turn. */
export const registeredTenderAgentTools = Object.keys(labels).map((name) => ({
  type: "function" as const,
  function: {
    name:
      name === "retrieveCompanyKnowledge"
        ? "knowledge_search"
        : name === "webVerify"
          ? "web_search"
          : name,
    description: labels[name as TenderToolName][1],
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        topK: { type: "number" },
        scope: { type: "string", enum: ["tender", "company", "all"] },
      },
      additionalProperties: false,
    },
  },
}));
const toolNameFromFunction = (name?: string): TenderToolName | undefined =>
  name === "knowledge_search"
    ? "retrieveCompanyKnowledge"
    : name === "web_search"
      ? "webVerify"
      : name && name in labels
        ? (name as TenderToolName)
        : undefined;
async function deepSeekChoice(
  state: State,
  history: Array<Record<string, unknown>>,
): Promise<{ tool?: TenderToolName; error?: string }> {
  if (!process.env.DEEPSEEK_API_KEY) return { error: "DeepSeek 未配置" };
  try {
    const allowed = allowedPolicyTools(state);
    const response = await fetch(
      `${(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
          stream: false,
          // Do not merely prompt the model about policy: expose only tools legal
          // for this observation, so a valid model call cannot bypass the guard.
          tools: registeredTenderAgentTools.filter((tool) =>
            allowed.includes(toolNameFromFunction(tool.function.name)!),
          ),
          tool_choice: "auto",
          messages: [
            {
              role: "system",
              content:
                "你是招投标 Tool Calling Agent。只可从给定工具中选择，并依据 observation 决定下一步。硬规则：普通 DOCX/可解析 PDF 不可调用 OCR；仅扫描 PDF/图片且没有可靠文本时才调用 OCR；资质、案例、人员、产品参数优先 retrieveCompanyKnowledge；仅最新政策、公开标准、外部企业或时效性事实可 webVerify；外网不能覆盖内部原始资料；无证据必须标为待确认。不要输出事实性结论，只调用工具或在工具齐备后结束。",
            },
            {
              role: "user",
              content: JSON.stringify({
                task: state.request.task ?? "分析招标文件并形成可核验技术应答",
                fileName: state.name,
                parse: state.parsed
                  ? {
                      fileType: state.parsed.fileType,
                      parseMethod: state.parsed.parseMethod,
                      status: state.parsed.status,
                      characterCount: state.parsed.characterCount,
                      pageCount: state.parsed.pageCount,
                    }
                  : undefined,
                requirements: state.document?.requirements
                  .map((item) => ({
                    category: item.category,
                    requirement: item.requirement,
                  }))
                  .slice(0, 40),
                scoringRuleCount: state.document?.scoringRules.length ?? 0,
                allowedTools: allowed,
                observations: history.slice(-8),
              }),
            },
          ],
          max_tokens: 300,
          thinking: { type: "disabled" },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok) {
      const body = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      return { error: `DeepSeek tool choice HTTP ${response.status}${body ? `：${body}` : ""}` };
    }
    const data = (await response.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { name?: string } }> };
      }>;
    };
    const selected =
      data.choices?.[0]?.message?.tool_calls?.[0]?.function?.name;
    const name = toolNameFromFunction(selected);
    if (!name)
      return { error: "DeepSeek 未返回可执行的工具调用。" };
    state.deepSeekToolCalls++;
    return { tool: name as TenderToolName };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    console.error("Tender Agent tool choice failed", detail);
    return { error: `DeepSeek tool choice 请求失败：${detail}` };
  }
}
type GroundedResponse = { answer: string; recommendation: string; citations: Array<{ sourceId: string; requirementId?: string }>; risks: string[]; suggestions: Record<string, string> };
type GroundedResponseAttempt = { output?: GroundedResponse; error?: string; raw?: string; missingFields: string[]; responseShape: string; parseFailure?: string };
function structuredOutputDiagnostic(values: { responseFormatUsed: boolean; rawResponseLength: number; responseShape: string; parseSuccess: boolean; retryCount: number; schemaValidationSuccess: boolean; missingFields: string[]; parseFailure?: string }) { console.info("[tender-structured-output]", values); }
function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 20) : []; }
function citations(value: unknown) { return Array.isArray(value) ? value.flatMap((item) => { if (typeof item === "string" && item.trim()) return [{ sourceId: item.trim() }]; if (!item || typeof item !== "object") return []; const record = item as { sourceId?: unknown; id?: unknown; requirementId?: unknown }; const sourceId = typeof record.sourceId === "string" ? record.sourceId : typeof record.id === "string" ? record.id : ""; return sourceId ? [{ sourceId, ...(typeof record.requirementId === "string" ? { requirementId: record.requirementId } : {}) }] : []; }).slice(0, 30) : []; }
function responseShape(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "empty";
  if (/^```(?:json)?\s*/i.test(trimmed)) return "json_code_fence";
  if (/^\{/.test(trimmed)) return "json_object_or_prose_object";
  if (/^\[/.test(trimmed)) return "json_array";
  return trimmed.includes("{") || trimmed.includes("[") ? "prose_wrapped_json" : "plain_text";
}
function removeJsonFence(raw: string) {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}
function firstCompleteJsonObject(raw: string) {
  for (let start = raw.indexOf("{"); start >= 0; start = raw.indexOf("{", start + 1)) {
    let depth = 0; let quoted = false; let escaped = false;
    for (let index = start; index < raw.length; index++) {
      const char = raw[index];
      if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') { quoted = true; continue; }
      if (char === "{") depth++;
      if (char === "}" && --depth === 0) {
        const candidate = raw.slice(start, index + 1);
        try { return JSON.parse(candidate) as unknown; } catch { break; }
      }
    }
  }
  return undefined;
}
function nestedRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 3 || !value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => nestedRecords(item, depth + 1));
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap((item) => nestedRecords(item, depth + 1))];
}
export function parseGroundedResponse(raw: string): GroundedResponseAttempt {
  const shape = responseShape(raw);
  const cleaned = removeJsonFence(raw);
  const values: unknown[] = [];
  try { values.push(JSON.parse(cleaned) as unknown); } catch { /* Fall through to a complete object embedded in prose. */ }
  const embedded = firstCompleteJsonObject(cleaned);
  if (embedded !== undefined) values.push(embedded);
  let parsedJson = values.length > 0;
  for (const value of values) {
    for (const record of nestedRecords(value)) {
      const answer = [record.answer, record.conclusion, record.summary, record.finalAnswer, record.final_answer, record.recommendation].find((item): item is string => typeof item === "string" && Boolean(item.trim()));
      if (!answer) continue;
      const missingFields = [
        ...(typeof record.answer === "string" && record.answer.trim() ? [] : ["answer"]),
        ...(typeof record.recommendation === "string" ? [] : ["recommendation"]),
        ...(Array.isArray(record.citations) || Array.isArray(record.evidence) ? [] : ["citations"]),
        ...(Array.isArray(record.risks) ? [] : ["risks"]),
      ];
      const suggestions = typeof record.suggestions === "object" && record.suggestions && !Array.isArray(record.suggestions)
        ? Object.fromEntries(Object.entries(record.suggestions).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim())))
        : {};
      return { output: { answer: answer.trim().slice(0, 5000), recommendation: typeof record.recommendation === "string" ? record.recommendation.trim().slice(0, 2000) : "", citations: citations(record.citations ?? record.evidence), risks: stringList(record.risks), suggestions }, missingFields, responseShape: shape, parseFailure: missingFields.includes("answer") ? "answer_mapped_from_compatible_field" : undefined };
    }
  }
  return { error: "DeepSeek 返回内容不是符合 schema 的 JSON 对象，或缺少核心 answer 字段。", raw: cleaned.slice(0, 6000), missingFields: ["answer"], responseShape: shape, parseFailure: parsedJson ? "answer_missing_or_invalid" : "invalid_json" };
}
async function composeGroundedResponse(state: State): Promise<GroundedResponseAttempt> {
  if (!process.env.DEEPSEEK_API_KEY || !state.document) return { error: "DeepSeek 未配置或招标文本未就绪。", missingFields: ["answer"], responseShape: "not_requested", parseFailure: "missing_configuration_or_document" };
  const matches = allMatches(state);
  const evidence = matches
    .flatMap((match) =>
      match.evidence.map((source) => ({
        requirementId: match.requirementId,
        sourceId: source.id,
        title: source.title,
        location: source.location,
        excerpt: source.excerpt,
      })),
    )
    .slice(0, 30);
  const endpoint = `${(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`;
  const baseMessages = [
    {
      role: "system",
      content:
        '你是证据约束的投标技术应答生成器。仅使用给定的招标要求、内部证据和已完成的规则分析。不得把外部资料写成我方事实，不得编造资质、案例、参数或价格。answer 只写面向项目负责人的自然语言简短判断：当前建议、主要原因、下一步行动，100～180 个中文字符，不得出现 REQ/CAP/DOC/COMPANY 编号、Evidence 索引、来源字段或逐条清单。只输出一个合法 JSON 对象：禁止 Markdown、```json code fence、JSON 前后说明。Schema：{"answer":string,"recommendation":string,"citations":[{"sourceId":string,"requirementId":string}],"risks":[string],"suggestions":{"REQ-ID":string}}。answer 必填；recommendation/citations/risks 无内容时分别使用空字符串、[]、[]；risks 最多 8 条。citations 只能使用给定 sourceId。suggestions 可为空对象；每一条 suggestion 必须保留“来源：”并引用给定 sourceId；无证据则写“待确认：当前资料未检索到…”。',
    },
    {
      role: "user",
      content: JSON.stringify({
        task: state.request.task ?? "分析招标文件并形成技术应答",
        requirements: state.document.requirements.map((item) => ({ id: item.id, category: item.category, requirement: item.requirement })),
        matches: matches.map((item) => ({ id: item.requirementId, status: item.status, reason: item.reason, evidenceIds: item.evidenceIds })),
        internalEvidence: evidence,
        externalEvidence: state.externalVerification.results.map((item) => ({ title: item.title, url: item.url, snippet: item.snippet })).slice(0, 5),
      }),
    },
  ];
  const request = async (messages: Array<{ role: string; content: string }>, retryCount: number) => {
    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
          response_format: { type: "json_object" },
          messages,
          max_tokens: 1800,
          stream: false,
          thinking: { type: "disabled" },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) { structuredOutputDiagnostic({ responseFormatUsed: true, rawResponseLength: 0, responseShape: "http_error", parseSuccess: false, retryCount, schemaValidationSuccess: false, missingFields: ["answer"], parseFailure: `http_${response.status}` }); return { error: `DeepSeek 综合结论 HTTP ${response.status}`, missingFields: ["answer"], responseShape: "http_error", parseFailure: `http_${response.status}` }; }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) { structuredOutputDiagnostic({ responseFormatUsed: true, rawResponseLength: 0, responseShape: "empty", parseSuccess: false, retryCount, schemaValidationSuccess: false, missingFields: ["answer"], parseFailure: "empty_content" }); return { error: "DeepSeek 综合结论响应为空。", missingFields: ["answer"], responseShape: "empty", parseFailure: "empty_content" }; }
    const parsed = parseGroundedResponse(raw);
    structuredOutputDiagnostic({ responseFormatUsed: true, rawResponseLength: raw.length, responseShape: parsed.responseShape, parseSuccess: Boolean(parsed.output), retryCount, schemaValidationSuccess: Boolean(parsed.output?.answer), missingFields: parsed.missingFields, parseFailure: parsed.parseFailure });
    return parsed;
  };
  try {
    const first = await request(baseMessages, 0);
    if (first.output) return first;
    const repaired = await request([
      ...baseMessages,
      { role: "assistant", content: first.raw ?? "" },
      { role: "user", content: '将上一条模型输出转换为唯一合法 JSON 对象。只可使用已提供的招标要求、规则分析和证据；不得补充新事实。禁止 Markdown、code fence 和解释。answer 必填。Schema：{"answer":string,"recommendation":string,"citations":[{"sourceId":string,"requirementId":string}],"risks":[string],"suggestions":{"REQ-ID":string}}。' },
    ], 1);
    return repaired.output ? repaired : { error: repaired.error ?? first.error ?? "DeepSeek structured output 修复失败。", missingFields: repaired.missingFields.length ? repaired.missingFields : first.missingFields, responseShape: repaired.responseShape, parseFailure: repaired.parseFailure ?? first.parseFailure };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    structuredOutputDiagnostic({ responseFormatUsed: true, rawResponseLength: 0, responseShape: "request_error", parseSuccess: false, retryCount: 0, schemaValidationSuccess: false, missingFields: ["answer"], parseFailure: reason });
    return { error: `DeepSeek 综合结论请求失败：${reason}`, missingFields: ["answer"], responseShape: "request_error", parseFailure: reason };
  }
}
function directAnswer(state: State) {
  const task = state.request.task || "";
  const info = state.document?.projectInfo;
  if (!info) return "待确认：未取得可解析的招标文本。";
  if (/项目编号/.test(task))
    return `项目编号：${info.projectCode}。来源：招标文件项目基本信息。`;
  if (/项目名称/.test(task))
    return `项目名称：${info.projectName}。来源：招标文件项目基本信息。`;
  if (/预算|最高限价|限价/.test(task))
    return `采购预算：${info.budget}；最高限价：${info.maxPrice}。来源：招标文件项目基本信息。`;
  if (/开标地点/.test(task))
    return `开标地点：${info.bidOpenLocation}。来源：招标文件项目基本信息。`;
  if (state.externalVerification.status === "NOT_CONFIGURED")
    return "待确认：已按任务发起 Tavily 外部核验，但 Tavily 未配置，无法确认所引政策或标准的当前有效性。";
  if (state.externalVerification.status === "FAILED")
    return "待确认：外部核验请求失败，不能据此判断政策或标准是否仍然有效。";
  if (state.externalVerification.results.length)
    return `已完成外部核验，返回 ${state.externalVerification.results.length} 条公开来源；请结合结果中的来源链接人工确认适用性。`;
  return state.matches.size
    ? "已完成证据分析；请查看逐条结论与来源。"
    : "已完成文件解析；当前任务未要求企业资料或外部核验。";
}
export function ruleAnalysisConclusion(matches: RequirementMatch[]) {
  const analysis = summary(matches, true);
  const categoryNames: Record<string, string> = {
    "资格审查": "资格条件",
    "技术偏离": "系统能力",
    "商务要求": "商务响应",
    "实施交付": "实施交付",
    "售后服务": "服务保障",
    "时间要求": "进度安排",
  };
  const gaps = matches.filter((item) => item.status !== "PASS");
  const focus = Array.from(new Set(gaps.map((item) => categoryNames[item.category]))).filter(Boolean).slice(0, 3);
  const focusSet = new Set(focus);
  const supported = Array.from(new Set(matches.filter((item) => item.status === "PASS").map((item) => categoryNames[item.category]).filter((category) => category && !focusSet.has(category)))).slice(0, 3);
  const judgment = analysis.recommendation === "可投" ? "当前初步判断：可投。" : analysis.recommendation === "有条件可投" ? "当前初步判断：有条件可投。" : analysis.recommendation === "不建议投" ? "当前初步判断：不建议投。" : "当前初步判断：暂缓决策。";
  const reason = supported.length
    ? `现有材料已覆盖${supported.join("、")}等主要方面${gaps.length ? `，但${focus.join("、") || "关键条件"}仍需核验` : "，整体准备较为充分"}。`
    : `现有材料尚不足以确认核心资格或关键技术能力，${focus.join("、") || "关键条件"}仍需核验。`;
  const action = gaps.length
    ? `建议优先准备：${priorityTenderMaterialPackages(gaps).join("；")}。具体逐条要求见下方“建议补充材料”。`
    : "建议复核关键证明材料的适用范围后，按既定节奏推进投标准备。";
  return `${judgment}${reason}${action}`.replace(/\s+/g, " ").trim().slice(0, 220);
}
export function priorityTenderMaterialPackages(matches: RequirementMatch[]) {
  const ranked = [...matches].sort((left, right) => Number(right.mandatory) - Number(left.mandatory) || Number(right.risk === "HIGH") - Number(left.risk === "HIGH") || Number(left.status === "MISSING_EVIDENCE") - Number(right.status === "MISSING_EVIDENCE"));
  const packageLabels = {
    subject: "主体及授权材料（营业执照、法人/授权文件）",
    finance: "财务及资信材料（财务报表、资信证明）",
    technical: "技术证明材料（产品参数、测试/认证材料）",
    project: "项目及人员材料（合同/验收、人员资质）",
    compliance: "合规及服务材料（信用声明、实施/服务承诺）",
  } as const;
  const packages = new Set<keyof typeof packageLabels>();
  for (const match of ranked) {
    const text = `${match.requirement} ${match.category}`;
    const materialPackage = /营业执照|主体资格|统一社会信用|投标人资格|法人|授权|委托|签章/.test(text)
      ? "subject"
      : /财务|审计|资信|银行/.test(text)
        ? "finance"
        : /技术|参数|规格|功能|性能|测试|认证|ISO|产品/.test(text) || match.category === "技术偏离"
          ? "technical"
          : /合同|案例|验收|中标|业绩|人员|项目经理|工程师|社保|简历/.test(text)
            ? "project"
            : /信用|节能|环保|中小企业|合规|声明|实施|交付|售后|服务|SLA|培训/.test(text)
              ? "compliance"
              : match.category === "资格审查"
                ? "subject"
                : "technical";
    packages.add(materialPackage);
    if (packages.size === 5) break;
  }
  return packages.size ? [...packages].map((id) => packageLabels[id]) : ["关键证明材料（主体资格证明、技术参数材料）"];
}
async function execute(state: State, id: TenderToolName): Promise<void> {
  const started = Date.now();
  if (id === "parseTenderDocument") {
    if (state.rawFiles.length) {
      state.parsedFiles = await Promise.all(
        state.rawFiles.map((file) => parseBidDocument(file, false)),
      );
      state.parsed =
        state.parsedFiles.find((item) => item.status === "OCR_REQUIRED") ??
        state.parsedFiles[0];
    } else {
      const text =
        state.request.mode === "sample"
          ? sampleTenderContent
          : state.request.content || "";
      state.parsed = {
        fileName: state.name,
        fileType: "TXT",
        fileSize: text.length,
        text,
        canonicalDocumentText: text,
        characterCount: text.length,
        sectionCount: 0,
        chunkingMethod: "fallback",
        parseMethod: "plain_text",
        status: "PARSED",
      };
      state.parsedFiles = [state.parsed];
    }
    if (state.parsedFiles.every((item) => item.status === "PARSED"))
      state.document = parseTenderDocument(
        state.name,
        state.parsedFiles
          .map(
            (item) =>
              `[[SOURCE:${item.fileName}]]\n${item.canonicalDocumentText}`,
          )
          .join("\n\n"),
      );
    state.execution.push(
      step(
        state,
        id,
        `文件：${state.name}`,
        state.parsedFiles.some((item) => item.status === "OCR_REQUIRED")
          ? `${state.parsedFiles.filter((item) => item.status === "OCR_REQUIRED").length} 份扫描件未获得可靠文本，等待 Agent 判断 OCR。`
          : `已解析 ${state.parsedFiles.length} 份文件并识别 ${state.document?.requirements.length ?? 0} 条要求。`,
        [],
        "completed",
        started,
      ),
    );
    return;
  }
  if (id === "ocrDocument") {
    const pendingIndex = state.parsedFiles.findIndex(
      (item) => item.status === "OCR_REQUIRED",
    );
    if (pendingIndex < 0) return;
    const rawFile = state.rawFiles[pendingIndex];
    if (!rawFile) return;
    state.parsed = state.parsedFiles[pendingIndex];
    const ocr = await ocrDocument(
      Buffer.from(await rawFile.arrayBuffer()),
      rawFile.type || "application/pdf",
    );
    if (ocr.status === "OCR_SUCCEEDED") {
      state.parsed = {
        ...state.parsed,
        text: ocr.text,
        canonicalDocumentText: ocr.pageResults.length
          ? ocr.pageResults
              .map((page) => `[[PAGE:${page.page}]]\n${page.text}`)
              .join("\n\n")
          : ocr.text,
        characterCount: ocr.text.length,
        sectionCount: 0,
        chunkingMethod: "fallback",
        pageCount: state.parsed.pageCount ?? ocr.pageResults.length,
        pages: ocr.pageResults.map((page) => ({ pageNumber: page.page, text: page.text })),
        parseMethod: "ocr",
        status: "PARSED",
        warning: ocr.warnings.join(" "),
      };
      state.parsedFiles[pendingIndex] = state.parsed;
      if (state.parsedFiles.every((item) => item.status === "PARSED"))
        state.document = parseTenderDocument(
          state.name,
          state.parsedFiles
            .map(
              (item) =>
                `[[SOURCE:${item.fileName}]]\n${item.canonicalDocumentText}`,
            )
            .join("\n\n"),
        );
    }
    const observation =
      ocr.status === "OCR_SUCCEEDED"
        ? `${ocr.provider}：${ocr.pageResults.length} 页，${ocr.text.length} 字符，置信度 ${ocr.confidence?.toFixed(2) ?? "未提供"}，${ocr.durationMs} ms。`
        : `OCR ${ocr.status === "OCR_UNAVAILABLE" ? "未配置，已明确降级" : "调用失败"}，不会模拟识别结果。`;
    state.execution.push(
      step(
        state,
        id,
        "扫描件无可靠文本",
        observation,
        [],
        ocr.status === "OCR_UNAVAILABLE"
          ? "not_configured"
          : ocr.status === "OCR_SUCCEEDED"
            ? "completed"
            : "failed",
        started,
        {
          provider: ocr.provider,
          fallback:
            ocr.status === "OCR_UNAVAILABLE"
              ? "OCR Provider 未配置"
              : undefined,
          error:
            ocr.status === "OCR_FAILED" ? ocr.warnings.join(" ") : undefined,
        },
      ),
    );
    return;
  }
  if (!state.document) return;
  if (id === "retrieveCompanyKnowledge") {
    const query = [
      state.request.task,
      ...state.document.requirements.map((item) => item.requirement),
    ]
      .filter(Boolean)
      .join("\n");
    const retrieved =
      state.request.companyMode === "workspace"
        ? await retrieveCompanyEvidence(query)
        : undefined;
    const records = retrieved
      ? retrieved.results.map(workspaceRecord)
      : searchCompanyEvidence(query);
    const result: ToolResult = {
      tool: id,
      query,
      results: records,
      sources: records.map((item) => item.source),
      confidence:
        records.length >= 2 ? "high" : records.length ? "medium" : "low",
      status: "completed",
    };
    state.toolResults.push(result);
    const methods = new Set(
      retrieved?.results.map((item) => item.retrievalMethod) ?? [],
    );
    const retrievalObservation = retrieved
      ? `keywordHits ${retrieved.keywordHits} · vectorHits ${retrieved.vectorHits} · finalHits ${retrieved.finalHits}${retrieved.fallback ? ` · ${retrieved.fallback}` : ""}`
      : `返回 ${records.length} 条示例企业证据。`;
    state.execution.push(
      step(
        state,
        id,
        "招标要求与用户任务",
        retrievalObservation,
        result.sources,
        "completed",
        started,
        {
          provider:
            state.request.companyMode === "workspace"
              ? "hybrid"
              : "示例企业资料",
          retrievalMethod:
            methods.size > 1 ? "mixed" : methods.values().next().value,
        },
      ),
    );
    return;
  }
  if (id === "webVerify") {
    const verificationQuery = [
      state.document.projectInfo.projectName,
      ...state.document.requirements.slice(0, 6).map((item) => item.requirement.slice(0, 80)),
    ].filter(Boolean).join(" ").slice(0, 600);
    const verified = await externalSearch(
      verificationQuery,
    );
    state.externalVerification = verified;
    const sources: TenderSource[] = verified.results.map((item, index) => ({
      id: `WEB-${index}`,
      title: item.title,
      excerpt: item.snippet.slice(0, 160),
      location: item.url,
      category: "外部公开信息",
    }));
    state.execution.push(
      step(
        state,
        id,
        "仅核验时效性外部事实",
        verified.status === "NOT_CONFIGURED"
          ? "Tavily 未配置，已明确降级；外部资料不会替代内部企业事实。"
          : verified.status === "COMPLETED"
            ? `外部核验成功，返回 ${sources.length} 条结果。`
            : verified.error === "no_results"
              ? "Tavily 请求成功，但未返回可用结果。"
              : `Tavily 外部核验未完成：${verified.error ?? "unknown_error"}。`,
        sources,
        verified.status === "NOT_CONFIGURED"
          ? "not_configured"
          : verified.status === "COMPLETED"
            ? "completed"
            : "failed",
        started,
        {
          provider: "tavily",
          fallback:
            verified.status === "NOT_CONFIGURED" ? "Tavily 未配置" : undefined,
          error: verified.status === "FAILED" ? verified.error : undefined,
        },
      ),
    );
    return;
  }
  if (id === "analyzeQualification" || id === "analyzeTechnicalDeviation") {
    const categories =
      id === "analyzeQualification"
        ? ["qualification"]
        : ["technical", "business", "delivery", "after-sales", "time"];
    const requirements = state.document.requirements.filter((item) =>
      categories.includes(item.category),
    );
    const matches =
      state.request.companyMode === "workspace"
        ? await Promise.all(requirements.map(workspaceMatch))
        : requirements.map(demoMatch);
    matches.forEach((item) => state.matches.set(item.requirementId, item));
    state.execution.push(
      step(
        state,
        id,
        `${requirements.length} 条招标要求 + 内部证据`,
        `完成 ${matches.length} 条判断；${matches.filter((item) => item.status !== "PASS").length} 条标记待确认或不满足。`,
        matches.flatMap((item) => item.evidence),
        "completed",
        started,
        { provider: "rule-engine" },
      ),
    );
    return;
  }
  if (id === "analyzeScoring") {
    if (state.document.scoringStatus !== "SCORING_FOUND") {
      const suspected = state.document.scoringStatus === "SCORING_SUSPECTED";
      state.execution.push(
        step(
          state,
          id,
          "评分章节检测结果",
          suspected
            ? "疑似存在评分标准，但当前无法可靠结构化，未生成任何虚假评分项。"
            : "本文件未提供明确评分标准，因此不进行评分预测。",
          [],
          "skipped",
          started,
          { provider: "rule-engine" },
        ),
      );
      return;
    }
    state.scoringAnalysis = scoring(
      state.document.scoringRules,
      allMatches(state),
    );
    state.execution.push(
      step(
        state,
        id,
        "评分规则 + 已核验证据",
        `完成 ${state.scoringAnalysis.length} 条评分项分析。`,
        state.document.scoringRules.map((item) => item.source),
        "completed",
        started,
        { provider: "rule-engine" },
      ),
    );
    return;
  }
  if (id === "generateTechnicalResponse") {
    const generated = await composeGroundedResponse(state);
    const fallback = solution(allMatches(state));
    if (generated.output) {
      const output = generated.output;
      fallback.sections = fallback.sections.map((section) => ({
        ...section,
        responseSuggestion:
          output.suggestions[section.title.split("｜")[0]] ||
          section.responseSuggestion,
      }));
      state.solution = fallback;
      state.finalAnswer = ruleAnalysisConclusion(allMatches(state));
      state.finalAnswerStatus = "generated";
      state.execution.push(
        step(
          state,
          id,
          "已核验内部证据与偏离结论",
          `DeepSeek 已生成 ${state.solution.sections.length} 个受证据约束的应答段落。`,
          state.solution.sections.flatMap((item) => item.sources),
          "completed",
          started,
          { provider: "deepseek" },
        ),
      );
    } else {
      state.solution = fallback;
      state.finalAnswer = ruleAnalysisConclusion(allMatches(state));
      // The DeepSeek error remains in the trace, but a validated rule result is
      // still a usable conclusion and must not make the whole analysis fail.
      state.finalAnswerStatus = "generated";
      state.finalAnswerError = generated.error;
      state.execution.push(
        step(
          state,
          id,
          "已核验内部证据与偏离结论",
          "DeepSeek structured output 未通过校验或修复，已改用规则分析结论。",
          state.solution.sections.flatMap((item) => item.sources),
          "completed",
          started,
          { provider: "rule-engine", fallback: "DeepSeek structured output 未通过校验或修复", error: [state.lastDecisionError, generated.error].filter(Boolean).join("；") },
        ),
      );
    }
    return;
  }
  if (id === "finalBidRecommendation") {
    const conclusion = summary(allMatches(state), true).recommendation;
    state.execution.push(
      step(
        state,
        id,
        "资格、技术、评分分析与证据缺口",
        `综合投标判断：${conclusion}。`,
        [],
        "completed",
        started,
        {
          provider:
            state.finalAnswerStatus === "generated" && !state.finalAnswerError
              ? "deepseek + rule-engine"
              : "rule-engine",
          fallback:
            state.finalAnswerError
              ? "DeepSeek structured output 未通过校验或修复，使用规则分析结论"
              : undefined,
        },
      ),
    );
  }
}

function completionStatus(step?: ExecutionStep): "completed" | "execution_failed" | "not_applicable" {
  if (!step) return "not_applicable";
  return step.status === "completed" ? "completed" : step.status === "failed" ? "execution_failed" : "not_applicable";
}
function taskCompletion(document: TenderAgentResult["document"], execution: ExecutionStep[], finalAnswerStatus: TenderAgentResult["finalAnswerStatus"]): TaskCompletion {
  const step = (id: TenderToolName) => execution.find((item) => item.id === id);
  const evidenceSteps = execution.filter((item) => ["retrieveCompanyKnowledge", "analyzeQualification", "analyzeTechnicalDeviation", "analyzeScoring"].includes(item.id));
  const tasks: TaskCompletion["tasks"] = [
    { id: "parse", label: "招标文件解析", status: completionStatus(step("parseTenderDocument")), detail: "文件解析与项目文本已进入分析链路。" },
    { id: "ocr", label: "OCR / 文本抽取", status: step("ocrDocument") ? completionStatus(step("ocrDocument")) : "not_applicable", detail: step("ocrDocument") ? "扫描件按需执行 OCR。" : "已获得可靠文本，无需 OCR。" },
    { id: "requirements", label: "招标要求识别", status: document.requirements.length || step("parseTenderDocument")?.status === "completed" ? "completed" : "execution_failed", detail: `已识别 ${document.requirements.length} 条可分析要求。` },
    { id: "retrieval", label: "企业资料检索", status: completionStatus(step("retrieveCompanyKnowledge")), detail: step("retrieveCompanyKnowledge") ? "仅检索内部企业资料并保留来源。" : "当前任务未要求企业资料检索。" },
    { id: "qualification", label: "资格审查", status: completionStatus(step("analyzeQualification")), detail: step("analyzeQualification") ? "逐条输出符合、待确认或证据缺口。" : "当前任务未触发资格审查。" },
    { id: "technical", label: "技术偏离分析", status: completionStatus(step("analyzeTechnicalDeviation")), detail: step("analyzeTechnicalDeviation") ? "基于已解析条款与 Evidence 完成判断。" : "当前任务未触发技术偏离分析。" },
    { id: "scoring", label: "评分规则分析", status: document.scoringStatus === "SCORING_FOUND" ? completionStatus(step("analyzeScoring")) : "insufficient_evidence", detail: document.scoringStatus === "SCORING_FOUND" ? "已按结构化评分规则分析。" : "文件未提供可可靠结构化的评分规则，不生成虚构分数。" },
    { id: "strategy", label: "售前策略生成", status: step("parseTenderDocument")?.status === "completed" ? "completed" : "execution_failed", detail: "风险、评分冲刺、倾向性与竞品策略均按证据或资料不足状态输出。" },
    { id: "conclusion", label: "综合结论生成", status: finalAnswerStatus === "generated" ? "completed" : finalAnswerStatus === "failed" ? "execution_failed" : "not_applicable", detail: finalAnswerStatus === "failed" ? "DeepSeek structured output 未通过校验或修复。" : "仅在本次任务需要生成综合结论时计入。" },
    { id: "evidence", label: "Evidence 可追溯结果", status: evidenceSteps.some((item) => item.sources.length) ? "completed" : evidenceSteps.length ? "insufficient_evidence" : "not_applicable", detail: evidenceSteps.some((item) => item.sources.length) ? "结果保留了可展开的来源。" : "当前没有可引用 Evidence，已明确标记资料不足。" },
  ];
  const applicable = tasks.filter((item) => item.status === "completed" || item.status === "execution_failed");
  const score = applicable.length ? Math.round(applicable.filter((item) => item.status === "completed").length / applicable.length * 100) : 0;
  return { score, status: tasks.some((item) => item.status === "execution_failed") ? "execution_failed" : tasks.some((item) => item.status === "insufficient_evidence") ? "partial" : "completed", tasks };
}

export async function runTenderAgent(
  request: TenderAgentRequest,
): Promise<TenderAgentResult> {
  const name =
    request.mode === "sample"
      ? sampleTenderName
      : request.files?.length
        ? `${request.files.length} 份招标项目资料`
        : request.file?.name || request.fileName || "未命名招标文件";
  const state: State = {
    runId: randomUUID(),
    request,
    name,
    rawFiles: request.files ?? (request.file ? [request.file] : []),
    parsedFiles: [],
    finalAnswerStatus: "not_required",
    execution: [],
    toolResults: [],
    matches: new Map(),
    externalVerification: {
      enabled: tavilyConfigured() && (!process.env.TENDER_WEB_SEARCH_PROVIDER || process.env.TENDER_WEB_SEARCH_PROVIDER === "tavily"),
      status: "NOT_EXECUTED",
      results: [],
    },
    deepSeekToolCalls: 0,
    currentDecisionSource: process.env.DEEPSEEK_API_KEY ? "fallback" : "rule",
  };
  const history: Array<Record<string, unknown>> = [];
  const llmEnabled = Boolean(process.env.DEEPSEEK_API_KEY);
  for (let turn = 0; turn < 12; turn++) {
    const allowed = allowedPolicyTools(state);
    if (!allowed.length) break;
    const decision = llmEnabled
      ? await deepSeekChoice(state, history)
      : undefined;
    const selected = decision?.tool;
    state.lastDecisionError = decision?.error;
    if (selected && !allowed.includes(selected))
      state.lastDecisionError = `DeepSeek 选择了当前策略不允许的工具 ${selected}。`;
    const tool = selected && allowed.includes(selected) ? selected : allowed[0];
    state.currentDecisionSource =
      selected && allowed.includes(selected)
        ? "llm"
        : llmEnabled
          ? "fallback"
          : "rule";
    await execute(state, tool);
    const last = state.execution.at(-1);
    if (last)
      history.push({
        tool: last.id,
        observation: last.trace.observation,
        sourceCount: last.trace.sourceCount,
        status: last.trace.status,
      });
    if (
      state.parsedFiles.some((item) => item.status === "OCR_REQUIRED") &&
      tool === "ocrDocument" &&
      state.execution.at(-1)?.status !== "completed"
    )
      break;
  }
  if (
    !state.document &&
    state.parsedFiles.some((item) => item.status === "OCR_REQUIRED")
  )
    state.document = parseTenderDocument(state.name, "项目名称：待 OCR 确认\n");
  if (!state.document) throw new Error("invalid_document");
  const matches = allMatches(state);
  const evidenceConflicts = detectEvidenceConflicts(
    matches,
    state.externalVerification,
  );
  const analysisSummary = summary(
    matches,
    state.execution.some(
      (item) =>
        item.id === "analyzeQualification" ||
        item.id === "analyzeTechnicalDeviation",
    ),
  );
  const scoringAnalysis = state.scoringAnalysis ?? scoring(state.document.scoringRules, matches);
  const presalesStrategy = presalesStrategyAnalysis(state.document, matches, scoringAnalysis);
  const finalSolution = state.solution ?? solution(matches);
  const usedToolCalling = state.deepSeekToolCalls > 0;
  const allTools = Object.keys(labels) as TenderToolName[];
  const toolCoverage = allTools.map((tool) => ({
    tool,
    status: state.execution.some((item) => item.id === tool && item.status === "skipped")
      ? ("skipped" as const)
      : state.execution.some((item) => item.id === tool)
        ? ("called" as const)
        : ("not_called" as const),
    reason: state.execution.some((item) => item.id === tool && item.status === "skipped")
      ? state.execution.find((item) => item.id === tool)?.resultSummary ?? "本次无需执行。"
      : state.execution.some((item) => item.id === tool)
        ? "本次任务实际执行。"
      : tool === "ocrDocument"
        ? "已获得可靠文本，未满足 OCR 触发条件。"
        : tool === "webVerify"
          ? "任务未涉及需联网核验的时效性外部事实。"
          : "当前任务不需要该工具。",
  }));
  const decisionSource = usedToolCalling
    ? ("llm" as const)
    : llmEnabled
      ? ("fallback" as const)
      : ("rule" as const);
  const debug =
    process.env.NODE_ENV === "development"
      ? {
          runId: state.runId,
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
          agentType: usedToolCalling
            ? ("deepseek-tool-calling" as const)
            : ("policy-state-machine" as const),
          decisionSource,
          actualToolCalls: state.execution.map((item) => item.id),
          events: state.execution.map((item) => item.trace),
          providerStatus: {
            deepSeek: llmEnabled
              ? ("configured" as const)
              : ("not_configured" as const),
            ocr:
              (["azure", "azure-read", "azure-document-intelligence"].includes(
                process.env.TENDER_OCR_PROVIDER?.trim().toLowerCase() || "azure-document-intelligence",
              )) &&
              Boolean(process.env.TENDER_OCR_ENDPOINT && process.env.TENDER_OCR_API_KEY)
                ? ("configured" as const)
                : ("not_configured" as const),
            tavily:
              tavilyConfigured() && (!process.env.TENDER_WEB_SEARCH_PROVIDER || process.env.TENDER_WEB_SEARCH_PROVIDER === "tavily")
                ? ("configured" as const)
                : ("not_configured" as const),
            embedding: process.env.TENDER_EMBEDDING_PROVIDER
              ? ("enabled" as const)
              : ("disabled" as const),
          },
        }
      : undefined;
  return {
    document: state.document,
    planner: {
      mode: usedToolCalling ? "deepseek-tool-calling" : "policy-state-machine",
      steps: state.execution.map((item) => ({
        tool: item.id,
        reason: item.reason,
        required: true,
      })),
      rationale: usedToolCalling
        ? "DeepSeek 通过 tools/tool_calls 在每个 observation 后选择下一工具；安全规则会阻止不合规调用。"
        : "DeepSeek 未配置、未返回工具调用或调用失败，使用同一工具注册表的可审计策略状态机降级。",
    },
    execution: state.execution,
    toolResults: state.toolResults,
    matches,
    matchScore: {
      value: analysisSummary.readinessScore,
      formula: analysisSummary.readinessFormula,
      passed: analysisSummary.passCount,
      pending: analysisSummary.pendingCount,
      missingEvidence: analysisSummary.missingEvidenceCount,
      failed: analysisSummary.failCount,
    },
    analysisSummary,
    scoringAnalysis,
    scoringStatus: state.document.scoringStatus,
    risks: risks(matches),
    presalesStrategy,
    solution: finalSolution,
    externalVerification: state.externalVerification,
    evidenceConflicts,
    companyMode: request.companyMode ?? "demo",
    notice: evidenceConflicts.length
      ? "发现内部资料与官方外部资料可能冲突，已标记为待人工确认。"
      : state.parsed?.status === "OCR_REQUIRED"
        ? "扫描件 OCR 未完成，未生成或推断任何招标事实；请配置 OCR 后重试。"
        : request.companyMode === "workspace"
          ? "当前使用真实企业资料库；无内部原始证据的结论均已标为待确认。"
          : "当前使用示例供应商资料；无证据时不会补全或虚构，正式投标须人工复核。",
    usedFallback: !usedToolCalling,
    file: state.parsed,
    files: state.parsedFiles,
    agentConclusion:
      state.parsed?.status === "OCR_REQUIRED"
        ? "待确认：扫描件未获得可靠文本，已停止后续事实分析。"
        : evidenceConflicts.length
          ? "发现证据冲突，已停止自动采信并要求人工确认。"
          : !analysisSummary.analyzed
            ? "已完成项目概览解析，等待进一步分析。"
            : matches.some((item) => item.status !== "PASS")
              ? "已完成证据驱动分析；所有证据不足或存在适用边界的事项均标记为待确认。"
              : "已完成证据驱动分析；正式投标前仍须复核原始材料。",
    finalAnswer: state.finalAnswer ?? directAnswer(state),
    finalAnswerStatus: state.finalAnswerStatus,
    finalAnswerError: state.finalAnswerError,
    taskCompletion: taskCompletion(state.document, state.execution, state.finalAnswerStatus),
    toolCoverage,
    debug,
  };
}

const knownProjectValue = (value: string) => value && value !== "待确认" && value !== "资料未提供";
const normalizeProjectValue = (value: string) => value.toLowerCase().replace(/[\s，。；：:（）()、"'“”]/g, "");
function projectWebQuery(document: TenderAgentResult["document"], fallback: string) {
  const info = document.projectInfo;
  if (knownProjectValue(info.projectCode)) return `"${info.projectCode}"`;
  if (knownProjectValue(info.projectName) && knownProjectValue(info.purchaser)) return `${info.projectName} ${info.purchaser} 招标 采购`;
  if (knownProjectValue(info.projectName)) return `${info.projectName} 招标 采购`;
  return fallback;
}
function officialDomainsForQuestion(question: string) {
  const domains = Array.from(question.matchAll(/\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi), (match) => match[1].toLowerCase());
  if (/浙江工业大学/.test(question)) return ["zhcg.zjut.edu.cn", "zjut.edu.cn"];
  return domains.filter((domain) => /\.(?:gov|edu|org)\.cn$/.test(domain));
}
function publishedTimestamp(value?: string) {
  if (!value) return 0;
  const normalized = value.replace(/[年/.]/g, "-").replace(/月/g, "-").replace(/日/g, "");
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
function isOfficialListPage(url: string) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /(?:^|\/)(?:index|list|more)(?:\.|\/|$)/.test(path) || /(?:notice|announcement|采购公告)\/?$/.test(path);
  } catch { return false; }
}
function officialLatestAnnouncementAnswer(verification: TenderAgentResult["externalVerification"], officialDomains: string[]) {
  const official = verification.results
    .filter((item) => officialDomains.some((domain) => item.domain === domain || item.domain.endsWith(`.${domain}`)))
    .sort((a, b) => publishedTimestamp(b.publishedAt) - publishedTimestamp(a.publishedAt));
  const dated = official.filter((item) => publishedTimestamp(item.publishedAt));
  // Never replace a newer official list-page record with an older detail page.
  // If Tavily did not return the matching detail page, return that list page clearly.
  const latest = dated[0];
  const officialList = official.find((item) => isOfficialListPage(item.url));
  if (!latest)
    return `未能从 ${officialDomains.join("、")} 的官方检索结果中取得可解析的发布日期，无法确认哪一条是最新公告。${officialList ? `\n\n官方公告列表：${officialList.url}` : ""}`;
  return [
    "已按官方页面发布日期倒序核验：",
    ...(isOfficialListPage(latest.url) ? ["未取得该公告对应的官方详情页，以下返回官方公告列表页。"] : []),
    `标题：${latest.title}`,
    `发布日期：${latest.publishedAt}`,
    `官方来源链接：${latest.url}`,
    ...(officialList && officialList.url !== latest.url ? [`官方公告列表：${officialList.url}`] : []),
  ].join("\n");
}
function validateProjectWebResults(verification: TenderAgentResult["externalVerification"], document: TenderAgentResult["document"]) {
  const info = document.projectInfo;
  const projectCode = knownProjectValue(info.projectCode) ? normalizeProjectValue(info.projectCode) : "";
  const projectName = knownProjectValue(info.projectName) ? normalizeProjectValue(info.projectName) : "";
  const purchaser = knownProjectValue(info.purchaser) ? normalizeProjectValue(info.purchaser) : "";
  const deadline = knownProjectValue(info.deadline) ? info.deadline.match(/\d{4}-\d{1,2}-\d{1,2}/)?.[0] : undefined;
  const conflicts: NonNullable<TenderAgentResult["externalVerification"]["projectConflicts"]> = [];
  const results = verification.results.map((item) => {
    const content = normalizeProjectValue(`${item.title} ${item.snippet}`);
    const codeMatch = Boolean(projectCode && content.includes(projectCode));
    const nameMatch = Boolean(projectName && (content.includes(projectName) || projectName.includes(content.slice(0, Math.min(content.length, projectName.length)))));
    const purchaserMatch = Boolean(purchaser && content.includes(purchaser));
    const dateMatch = Boolean(deadline && `${item.title} ${item.snippet}`.includes(deadline));
    const reasons = [codeMatch ? "项目编号一致" : "", nameMatch ? "项目名称一致" : "", purchaserMatch ? "采购人一致" : "", dateMatch ? "关键日期一致" : ""].filter(Boolean);
    const matched = (codeMatch && (nameMatch || purchaserMatch)) || (nameMatch && purchaserMatch);
    const publishedAfterDeadline = Boolean(deadline && item.publishedAt && item.publishedAt > deadline);
    if (publishedAfterDeadline) conflicts.push({ field: "日期", fileValue: `投标截止时间：${info.deadline}`, fileSource: info.evidence?.deadline?.sourceFile || document.name, externalValue: `页面发布日期：${item.publishedAt}`, title: item.title, url: item.url });
    return { ...item, projectMatch: publishedAfterDeadline ? "CONFLICT" as const : matched ? "MATCHED" as const : "UNCONFIRMED" as const, matchReasons: reasons };
  });
  return { ...verification, projectBound: true, projectConflicts: conflicts, results };
}

export async function answerTenderQuestion(
  result: TenderAgentResult,
  question: string,
  conversation: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<{ answer: string; status: "completed" | "failed"; webSearch?: TenderAgentResult["externalVerification"]; webEvidence?: TenderSource[]; trace?: ExecutionStep }> {
  const explicitWebRequest = /官网|公告|请联网|联网核验|帮我搜索|查询官网|核验来源|给我链接|来源\s*url/i.test(question);
  const officialSourceRequested = /官网|官方网站|官方来源/.test(question);
  const wantsLatest = /最新|当前|现在|今日|最近/.test(question);
  const localTenderQuestion = /当前(?:上传)?招标文件|本项目|这份招标文件/.test(question);
  const needsWebSearch = explicitWebRequest || (!localTenderQuestion && /最新|当前|现在|今日|最近|政策|市场信息|厂商信息|最新价格|外部公开信息/.test(question));
  const officialDomains = officialSourceRequested ? officialDomainsForQuestion(question) : [];
  const organization = /浙江工业大学/.test(question) ? "浙江工业大学" : question.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}(?:大学|学院|公司|集团|官网)/)?.[0]?.replace(/官网$/, "");
  const topic = question.match(/采购公告|招标公告|采购|招标|政策|API 文档|文档|价格|市场信息/)?.[0];
  const purchaser = result.document.projectInfo.purchaser;
  const explicitlyDifferentOrganization = Boolean(organization && knownProjectValue(purchaser) && !normalizeProjectValue(purchaser).includes(normalizeProjectValue(organization)));
  const projectBoundSearch = needsWebSearch && (localTenderQuestion || /当前项目|本项目|当前招标/.test(question)) && !explicitlyDifferentOrganization;
  const genericQuery = `${organization ?? ""} ${topic ?? "公开信息"} ${wantsLatest ? "最新" : ""}`.trim().slice(0, 100);
  const webQuery = needsWebSearch
    ? projectBoundSearch ? projectWebQuery(result.document, genericQuery) : genericQuery
    : undefined;
  const searched = webQuery ? await externalSearch(webQuery, officialDomains.length ? { includeDomains: officialDomains, sortByPublishedDate: wantsLatest, maxResults: 10 } : undefined) : undefined;
  const webSearch = searched && projectBoundSearch ? validateProjectWebResults(searched, result.document) : searched;
  const webEvidence: TenderSource[] = (webSearch?.results ?? []).map((item, index) => ({
    id: `WEB-CHAT-${index + 1}`,
    title: projectBoundSearch && item.projectMatch !== "MATCHED" ? `未确认的外部参考信息：${item.title}` : item.title,
    sourceFile: item.domain,
    excerpt: item.snippet.slice(0, 320),
    quote: item.snippet.slice(0, 320),
    location: item.url,
    category: "外部公开信息",
  }));
  const webTrace: ExecutionStep | undefined = webSearch
    ? {
        id: "webVerify",
        label: "联网检索",
        purpose: "通过 Tavily 核验用户请求的实时外部公开信息",
        reason: "用户问题包含明确的联网或时效性外部信息请求。",
        inputSummary: `web_search：${webQuery}`,
        resultSummary: webSearch.status === "COMPLETED" ? `Tavily 查询“${webQuery}”成功，返回 ${webSearch.results.length} 条结果。` : `Tavily 查询“${webQuery}”未成功：${webSearch.error ?? "unknown_error"}。`,
        sources: webEvidence,
        status: webSearch.status === "COMPLETED" ? "completed" : webSearch.status === "NOT_CONFIGURED" ? "not_configured" : "failed",
        durationMs: 1,
        trace: {
          runId: result.debug?.runId ?? "chat",
          stepId: `${result.debug?.runId ?? "chat"}-web-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "tool",
          tool: "webVerify",
          status: webSearch.status === "COMPLETED" ? "success" : webSearch.status === "NOT_CONFIGURED" ? "fallback" : "failed",
          decisionSource: "rule",
          sourceCount: webEvidence.length,
          observation: webSearch.status === "COMPLETED" ? `web_search 成功：${webQuery}，${webEvidence.length} 条结果。` : `web_search 失败：${webSearch.error ?? "unknown_error"}。`,
          provider: "tavily",
          fallback: webSearch.status === "NOT_CONFIGURED" ? "missing_api_key" : undefined,
          error: webSearch.status === "COMPLETED" ? undefined : webSearch.error,
        },
      }
    : undefined;
  const confirmedWebResults = (webSearch?.results ?? []).filter((item) => !projectBoundSearch || item.projectMatch === "MATCHED");
  const webEvidenceAppendix = webSearch?.status === "COMPLETED"
    ? `\n\n${projectBoundSearch && !confirmedWebResults.length ? "联网结果未通过同项目校验，仅作为未确认的外部参考信息，不作为当前项目事实。" : "联网检索证据"}（Tavily，查询时间：${webSearch.results[0]?.retrievedAt ?? "—"}）：\n${webSearch.results.map((item) => `- 来源：${item.domain}\n  页面：${item.title}\n  项目校验：${item.projectMatch === "MATCHED" ? item.matchReasons?.join("、") || "已确认" : item.projectMatch === "CONFLICT" ? "发现外部信息冲突" : "未确认"}\n  发布日期：${item.publishedAt ?? "页面未提供明确发布日期"}\n  URL：${item.url}`).join("\n")}`
    : webSearch
      ? `\n\n联网检索失败（${webSearch.error ?? "unknown_error"}），本次回答仅基于当前招标文件和企业知识库。`
      : "";
  const evidenceQuestion = /资质|资格|条件|哪一页|第几页|页码|原文|依据|在哪/.test(question);
  const riskIndex = question.match(/第\s*([一二三四五六七八九十\d]+)\s*个风险/)?.[1];
  const numberFromChinese = (value?: string) => {
    if (!value) return undefined;
    const digits = Number(value);
    if (Number.isFinite(digits) && digits > 0) return digits;
    return "一二三四五六七八九十".indexOf(value) + 1 || undefined;
  };
  const referencedRequirementIds = riskIndex
    ? result.risks[numberFromChinese(riskIndex)! - 1]?.relatedRequirementIds ?? []
    : [];
  const relevantMatches = result.matches.filter((item) =>
    referencedRequirementIds.length
      ? referencedRequirementIds.includes(item.requirementId)
      : /资质|资格/.test(question)
        ? item.category === "资格审查"
        : true,
  ).slice(0, 8);
  const tenderEvidence = relevantMatches.flatMap((item) =>
    item.evidence
      .filter((source) => source.category === "招标文件")
      .map((source) => ({
        requirement: item.requirement,
        judgment: item.reason,
        sourceFile: source.sourceFile || source.documentName || source.title,
        pageNumber: source.pageNumber ?? source.page,
        quote: source.quote || source.excerpt,
        chunkId: source.chunkId,
      })),
  );
  const evidenceAppendix = evidenceQuestion && tenderEvidence.length
    ? `\n\n原文证据：\n${tenderEvidence.map((item) => `- 条件：${item.requirement}\n  文件：${item.sourceFile}\n  页码：${item.pageNumber ? `第 ${item.pageNumber} 页` : "页码未定位（解析文本未保留可验证页边界）"}\n  原文：“${item.quote}”\n  判断：${item.judgment}${item.chunkId ? `\n  片段：${item.chunkId}` : ""}`).join("\n")}`
    : "";
  const context = {
    recommendation: result.analysisSummary.recommendation,
    finalAnswer: result.finalAnswer,
    matches: result.matches.map((item) => ({
      requirement: item.requirement,
      status: item.status,
      risk: item.risk,
      reason: item.reason,
      sources: item.evidence.map((source) => ({
        sourceFile: source.sourceFile || source.documentName || source.title,
        pageNumber: source.pageNumber ?? source.page,
        quote: source.quote || source.excerpt,
        chunkId: source.chunkId,
      })),
    })),
    risks: result.risks.slice(0, 8),
    conversation: conversation.slice(-6),
  };
  if (officialSourceRequested && wantsLatest && officialDomains.length && webSearch?.status === "COMPLETED")
    return { answer: officialLatestAnnouncementAnswer(webSearch, officialDomains), status: "completed", webSearch, webEvidence, trace: webTrace };
  if (officialSourceRequested && wantsLatest && officialDomains.length && webSearch)
    return {
      answer: `未能从 ${officialDomains.join("、")} 获得带可核验发布日期的官方采购公告，因此无法确认“最新”条目；未使用第三方转载替代官方来源。`,
      status: "failed",
      webSearch,
      webEvidence,
      trace: webTrace,
    };
  if (!process.env.DEEPSEEK_API_KEY && webSearch?.status === "COMPLETED")
    return { answer: `已完成联网检索。${webEvidenceAppendix.trim()}`, status: "completed", webSearch, webEvidence, trace: webTrace };
  if (!process.env.DEEPSEEK_API_KEY && webSearch)
    return { answer: `联网检索未完成：${webSearch.error ?? "unknown_error"}。本次无法核验该实时外部信息。`, status: "failed", webSearch, webEvidence, trace: webTrace };
  if (!process.env.DEEPSEEK_API_KEY && evidenceAppendix)
    return { answer: evidenceAppendix.trim(), status: "completed" };
  if (!process.env.DEEPSEEK_API_KEY)
    return {
      answer:
        "AI 问答不可用：DeepSeek 未配置。现有规则分析仍可在投标分析总览中查看。",
      status: "failed",
    };
  try {
    const response = await fetch(
      `${(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "你是招投标项目问答助手。仅基于给定的已完成投标分析、证据和连续对话回答。优先使用当前招标文件和企业资料；仅当代码层提供 webEvidence 时才可引用联网信息，绝不可编造 URL 或日期。若 webEvidence 非空，必须明确说明“已通过联网检索获得以下结果”，再引用其中给定的来源；只有 webSearchFailure 已提供时才可说明联网未完成或无法联网。代词、补充材料和‘最大风险’均指当前项目及此前对话；不得重新执行 OCR、RAG、评分或外部搜索。不得虚构企业资质或招标事实；信息不足时明确说待确认并指出缺失材料。当用户问资质、条件、原文、依据或哪一页时，必须逐项给出“文件、页码、原文、判断”；pageNumber 缺失时只能写“页码未定位”及给定原因，绝不能猜测页码。面向业务用户写中文，不输出 PASS、PENDING、MISSING_EVIDENCE、FAIL、Demo、文件路径或内部状态码。",
            },
            {
              role: "user",
              content: JSON.stringify({ question, analysis: context, webEvidence: webSearch?.status === "COMPLETED" ? webSearch.results.map((item) => ({ title: item.title, url: item.url, domain: item.domain, publishedAt: item.publishedAt, snippet: item.snippet, retrievedAt: item.retrievedAt })) : [], webSearchFailure: webSearch?.status === "COMPLETED" ? undefined : webSearch?.error }),
            },
          ],
          max_tokens: 1800,
          thinking: { type: "disabled" },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      return {
        answer:
          `AI 问答生成失败：DeepSeek 未返回成功响应。现有规则分析未被清空。${webEvidenceAppendix}`,
        status: "failed",
        webSearch,
        webEvidence,
        trace: webTrace,
      };
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    return answer
      ? { answer: `${answer}${evidenceAppendix}${webEvidenceAppendix}`, status: "completed", webSearch, webEvidence, trace: webTrace }
      : {
          answer:
            `AI 问答生成失败：DeepSeek 未返回有效回答。现有规则分析未被清空。${webEvidenceAppendix}`,
          status: "failed",
          webSearch,
          webEvidence,
          trace: webTrace,
        };
  } catch (error) {
    console.error(
      "Tender Agent question response failed",
      error instanceof Error ? error.message : "unknown_error",
    );
    return {
      answer: `AI 问答生成失败：请求未完成。现有规则分析未被清空。${webEvidenceAppendix}`,
      status: "failed",
      webSearch,
      webEvidence,
      trace: webTrace,
    };
  }
}
