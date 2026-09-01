import type {
  TenderDocument,
  TenderProjectInfo,
  TenderRequirement,
  TenderSection,
  TenderSectionType,
  TenderSource,
  ScoringStatus,
} from "@/types/tender-agent";

const source = (
  id: string,
  title: string,
  excerpt: string,
  line: number,
  documentName?: string,
  pageNumber?: number,
): TenderSource => ({
  id,
  title: documentName || title,
  excerpt,
  quote: excerpt,
  sourceFile: documentName || title,
  pageNumber,
  location: pageNumber
    ? `${documentName || title} · 第 ${pageNumber} 页`
    : `${documentName || title} · 页码未定位`,
  category: "招标文件",
  documentName: documentName || title,
  chunkId: `${id}-L${line}`,
  page: pageNumber,
});
const unavailable = "待确认";
const sectionType = (value: string): TenderSectionType =>
  /授权委托书|法定代表人证明|投标函|承诺书|投标文件格式|签字盖章|格式文件|响应文件格式/.test(
    value,
  )
    ? "TEMPLATE"
    : /合同|法律责任|违约|争议解决/.test(value)
      ? "LEGAL"
      : /废标|无效投标|否决投标/.test(value)
        ? "BID_INVALID"
        : /评分标准|评审标准|评分办法|评标办法/.test(value)
          ? "SCORING"
          : /资格条件|资格要求|供应商资格|投标人资格|业绩要求/.test(value)
            ? "QUALIFICATION"
            : /技术参数|技术要求|技术规格|性能参数|配置要求/.test(value)
              ? "TECHNICAL"
              : /商务要求|商务条款/.test(value)
                ? "BUSINESS"
                : /售后|运维|服务保障|培训/.test(value)
                  ? "AFTER_SALES"
                  : /实施|交付|验收|建设周期|服务期限|项目计划/.test(value)
                    ? "DELIVERY"
                    : /项目概况|项目基本信息|采购公告|采购需求|招标公告/.test(
                          value,
                        )
                      ? "PROJECT_INFO"
                      : "OTHER";
const heading = (line: string) => {
  const numberedTitle = line.replace(/^\d+(?:\.\d+)*[、.．]?\s*/, "");
  return (
    /^(?:第[一二三四五六七八九十\d]+[章节]|[一二三四五六七八九十]+[、.．])/.test(
      line,
    ) ||
    /^(?:项目概况|采购需求|资格要求|技术要求|评分标准|商务要求|售后服务|投标文件格式)/.test(
      line,
    ) ||
    (/^\d+(?:\.\d+)*[、.．]?\s+/.test(line) &&
      /项目概况|采购需求|资格要求|技术要求|评分标准|商务要求|售后服务|投标文件格式|授权委托书|合同/.test(
        numberedTitle,
      ))
  );
};
const stripNumber = (line: string) =>
  line
    .replace(
      /^(?:[一二三四五六七八九十\d]+[、.．]|[（(]\d+[)）]|\d+[、.)）])\s*/,
      "",
    )
    .trim();
const excluded = (type: TenderSectionType) =>
  type === "TEMPLATE" || type === "LEGAL";
const scoringHeader = (value: string) =>
  /^(?:序号|评分项(?:目|因素)?|评分标准|评分|得分|分值|打分方法|备注|评审内容|满分)$/
    .test(value.replace(/[：:|｜\s]/g, ""));
const scoringKeywords = /评分标准|评审标准|评标办法|评分办法|评分细则|技术评分|商务评分|价格评分|评分因素|评分项目|分值|得分/;
function structuredScoringRule(value: string) {
  const name = value
    .split(/[：:|｜\t]/)[0]
    .replace(/^\d+[、.．)]\s*/, "")
    .trim();
  if (!name || scoringHeader(name) || !/\d+(?:\.\d+)?\s*分/.test(value)) return undefined;
  return { category: name, score: value.match(/(\d+(?:\.\d+)?)\s*分/)?.[0] ?? "未明确" };
}
const valueFrom = (
  lines: Array<{ text: string; type: TenderSectionType }>,
  labels: string[],
) => {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (excluded(line.type) || /授权|委托|签字|盖章|代表我方/.test(line.text))
      continue;
    for (const label of labels) {
      const match = line.text.match(
        new RegExp(`${label}[：:]\\s*([^\\n]+)`, "i"),
      );
      if (match?.[1]) return match[1].trim().replace(/[。；;]$/, "");
      const standalone = line.text.replace(/[：:]$/, "").trim();
      if (
        standalone === label ||
        (label === "预算" && standalone === "采购预算")
      ) {
        const next = lines
          .slice(index + 1)
          .find(
            (item) =>
              !excluded(item.type) &&
              item.text &&
              !/^(?:项目名称|项目编号|采购人|采购预算|最高限价|采购方式|投标截止时间|开标地点)[：:]?$/.test(
                item.text,
              ),
          );
        if (next) return next.text.trim().replace(/[。；;]$/, "");
      }
    }
  }
  return unavailable;
};
function requirementCategory(
  type: TenderSectionType,
  body: string,
): TenderRequirement["category"] {
  if (type === "BID_INVALID") return "business";
  if (type === "DELIVERY") return "delivery";
  if (type === "AFTER_SALES") return "after-sales";
  if (type === "BUSINESS") return "business";
  if (
    type === "QUALIFICATION" ||
    /资质|资格|项目经理|人员|案例|业绩|信用|财务/.test(body)
  )
    return "qualification";
  return "technical";
}

export function parseTenderDocument(
  name: string,
  rawContent: string,
): TenderDocument {
  const content = rawContent
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .trim();
  if (!content || content.length < 8) throw new Error("invalid_document");
  if (content.length > 120000) throw new Error("document_too_large");
  let currentDocumentName: string | undefined;
  let currentPageNumber: number | undefined;
  const rawLines = content.split("\n").flatMap((text, index) => {
    const marker = text.trim().match(/^\[\[SOURCE:(.+)\]\]$/);
    if (marker) {
      currentDocumentName = marker[1].trim();
      currentPageNumber = undefined;
      return [];
    }
    const pageMarker = text.trim().match(/^\[\[PAGE:(\d+)\]\]$/);
    if (pageMarker) {
      currentPageNumber = Number(pageMarker[1]);
      return [];
    }
    const trimmed = text.trim();
    return trimmed
      ? [{ text: trimmed, line: index + 1, documentName: currentDocumentName, pageNumber: currentPageNumber }]
      : [];
  });
  const documentNameByLine = new Map(
    rawLines.map((item) => [item.line, item.documentName]),
  );
  const pageNumberByLine = new Map(rawLines.map((item) => [item.line, item.pageNumber]));
  const sections: TenderSection[] = [];
  let current: TenderSection = {
    type: "OTHER",
    title: "未分类内容",
    startLine: 1,
    content: [],
    lineNumbers: [],
  };
  for (const item of rawLines) {
    if (heading(item.text)) {
      if (current.content.length) sections.push(current);
      current = {
        type: sectionType(item.text),
        title: item.text,
        startLine: item.line,
        content: [],
        lineNumbers: [],
      };
    } else {
      current.content.push(item.text);
      current.lineNumbers?.push(item.line);
    }
  }
  if (current.content.length) sections.push(current);
  // OCR documents frequently contain usable paragraphs but no reliable numbered headings.
  // Preserve every paragraph as a retrievable fallback section instead of treating it as no document.
  const hasStandardHeadings = sections.some(
    (section) => section.type !== "OTHER",
  );
  if (!hasStandardHeadings) {
    const fallback: TenderSection[] = [];
    let buffer: string[] = [];
    let lineNumbers: number[] = [];
    let startLine = 1;
    const flush = () => {
      if (buffer.length)
        fallback.push({
          type: "OTHER",
          title: `正文片段 ${fallback.length + 1}`,
          startLine,
          content: buffer,
          lineNumbers,
        });
      buffer = [];
      lineNumbers = [];
    };
    for (const item of rawLines) {
      if (!buffer.length) startLine = item.line;
      if (buffer.join("\n").length + item.text.length > 700) flush();
      buffer.push(item.text);
      lineNumbers.push(item.line);
    }
    flush();
    sections.splice(0, sections.length, ...fallback);
  }
  const typedLines = sections.flatMap((section) =>
    section.content.map((text, offset) => ({
      text,
      type: section.type,
      line: section.lineNumbers?.[offset] ?? section.startLine + offset + 1,
    })),
  );
  const sourceForLabels = (labels: string[]) => {
    const line = typedLines.find((item) =>
      labels.some((label) => new RegExp(`${label}[：:]|^${label}$`, "i").test(item.text)),
    );
    return line
      ? source(
          `DOC-${line.line}`,
          name,
          line.text,
          line.line,
          documentNameByLine.get(line.line),
          pageNumberByLine.get(line.line),
        )
      : undefined;
  };
  const projectInfo: TenderProjectInfo = {
    projectName: valueFrom(typedLines, ["项目名称", "采购项目名称"]),
    projectCode: valueFrom(typedLines, ["项目编号", "采购编号", "招标编号"]),
    purchaser: valueFrom(typedLines, ["采购人", "采购单位"]),
    agency: valueFrom(typedLines, ["采购代理机构", "代理机构"]),
    budget: valueFrom(typedLines, ["项目预算", "采购预算", "预算金额", "预算"]),
    maxPrice: valueFrom(typedLines, ["最高限价", "最高投标限价"]),
    procurementMethod: valueFrom(typedLines, ["采购方式"]),
    deadline: valueFrom(typedLines, ["投标截止时间", "递交投标文件截止时间"]),
    bidOpenTime: valueFrom(typedLines, ["开标时间"]),
    bidOpenLocation: valueFrom(typedLines, ["开标地点"]),
    deliveryPeriod: valueFrom(typedLines, [
      "服务期限",
      "建设周期",
      "交付周期",
      "服务期",
    ]),
    location: valueFrom(typedLines, ["交付地点", "项目地点", "服务地点"]),
    targetSummary: valueFrom(typedLines, ["采购标的", "采购内容", "项目概况"]),
    evidence: {
      purchaser: sourceForLabels(["采购人", "采购单位"]),
      budget: sourceForLabels(["项目预算", "采购预算", "预算金额", "预算"]),
      maxPrice: sourceForLabels(["最高限价", "最高投标限价"]),
      deadline: sourceForLabels(["投标截止时间", "递交投标文件截止时间"]),
      bidOpenTime: sourceForLabels(["开标时间"]),
      deliveryPeriod: sourceForLabels(["服务期限", "建设周期", "交付周期", "服务期"]),
      targetSummary: sourceForLabels(["采购标的", "采购内容", "项目概况"]),
    },
  };
  const requirements: TenderRequirement[] = [];
  const scoringRules: TenderDocument["scoringRules"] = [];
  const deliverables: string[] = [];
  for (const section of sections) {
    if (excluded(section.type)) continue;
    for (let offset = 0; offset < section.content.length; offset++) {
      const original = section.content[offset];
      const body = stripNumber(original);
      const line = section.lineNumbers?.[offset] ?? section.startLine + offset + 1;
      if (section.type === "SCORING") {
        const parsedRule = structuredScoringRule(body);
        if (parsedRule)
          scoringRules.push({
            ...parsedRule,
            description: body,
            source: source(
              `DOC-${line}`,
              name,
              body,
              line,
              documentNameByLine.get(line),
              pageNumberByLine.get(line),
            ),
          });
      }
      const inferredType: TenderSectionType =
        section.type === "SCORING" && /废标|无效投标|否决投标/.test(body)
          ? "BID_INVALID"
          : section.type === "OTHER"
            ? /资格|资质|投标人|供应商|业绩|项目经理|信用|财务/.test(body)
              ? "QUALIFICATION"
              : /评分|得分|分值/.test(body)
                ? "SCORING"
                : /交付|实施|验收|工期|服务期/.test(body)
                  ? "DELIVERY"
                  : /售后|运维|培训|质保/.test(body)
                    ? "AFTER_SALES"
                    : /技术|系统|平台|参数|功能|性能|支持|兼容/.test(body)
                      ? "TECHNICAL"
                      : /(?:演示要求|现场演示|功能演示)/i.test(body)
                        ? "BUSINESS"
                        : "OTHER"
            : section.type;
      const candidateSection = [
        "QUALIFICATION",
        "TECHNICAL",
        "BUSINESS",
        "DELIVERY",
        "AFTER_SALES",
        "BID_INVALID",
      ].includes(inferredType);
      const requirementCue =
        /应|须|需|支持|提供|完成|不少于|具备|采用|满足|不得|兼容|配置|培训|服务|验收|无效|废标|否决|演示/.test(
          body,
        );
      if (candidateSection && requirementCue && body.length >= 5) {
        const mandatory = /硬性|须|必须|不得|不少于|▲|★/.test(body);
        const score = body.match(/(?:技术)?评分\s*(\d+(?:\.\d+)?)\s*分/)?.[1];
        requirements.push({
          id: `REQ-${String(requirements.length + 1).padStart(2, "0")}`,
          category: requirementCategory(inferredType, body),
          requirement: body,
          mandatory,
          scoreWeight: score ? Number(score) : undefined,
          source: source(
            `DOC-${line}`,
            name,
            body,
            line,
            documentNameByLine.get(line),
            pageNumberByLine.get(line),
          ),
        });
        if (inferredType === "DELIVERY" || inferredType === "AFTER_SALES")
          deliverables.push(body);
      }
    }
  }
  const scoringStatus: ScoringStatus = scoringRules.length
    ? "SCORING_FOUND"
    : scoringKeywords.test(content)
      ? "SCORING_SUSPECTED"
      : "SCORING_NOT_FOUND";
  return {
    name,
    content,
    canonicalDocumentText: content,
    chunkingMethod: hasStandardHeadings ? "heading" : "fallback",
    projectInfo,
    sections,
    requirements,
    scoringRules,
    scoringStatus,
    deliverables,
  };
}
