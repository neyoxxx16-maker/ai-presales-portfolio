import type { TenderDocument, TenderProjectInfo, TenderRequirement, TenderSource } from "@/types/tender-agent";

const source = (id: string, title: string, excerpt: string, line: number): TenderSource => ({ id, title, excerpt, location: `招标文件第 ${line} 行`, category: "招标文件" });
const valueAfter = (content: string, label: string) => content.match(new RegExp(`${label}[：:]\\s*([^\\n]+)`))?.[1]?.trim() ?? "资料未提供";
const categoryOf = (line: string, section: string): TenderRequirement["category"] => /交付|培训|验收|联调|试运行/.test(line) ? "delivery" : /截止|周期|时间/.test(line) ? "time" : /ISO|成立|资质|著作权|资格/.test(line) || /资格条件/.test(section) ? "qualification" : "technical";

export function parseTenderDocument(name: string, rawContent: string): TenderDocument {
  const content = rawContent.replace(/\r/g, "").replace(/\u0000/g, "").trim();
  if (!content || content.length < 8) throw new Error("invalid_document");
  if (content.length > 120000) throw new Error("document_too_large");
  const lines = content.split("\n");
  const projectInfo: TenderProjectInfo = {
    projectName: valueAfter(content, "项目名称"), budget: valueAfter(content, "预算"), deadline: valueAfter(content, "投标截止时间"), deliveryPeriod: valueAfter(content, "交付周期"), location: valueAfter(content, "项目地点"),
  };
  let section = "";
  const requirements: TenderRequirement[] = [];
  const scoringRules: TenderDocument["scoringRules"] = [];
  const deliverables: string[] = [];
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    if (/^[一二三四五六七八九十]+、/.test(line)) { section = line; return; }
    const body = line.replace(/^\d+[.、)]\s*/, "");
    const isRequirement = /应|须|需|支持|提供|完成|不少于|具备/.test(body) && (section.includes("资格") || section.includes("技术") || section.includes("交付") || /ISO|RAG|部署|案例|培训|验收|数据库/.test(body));
    if (isRequirement) {
      const mandatory = /硬性|须|必须|不少于/.test(body);
      const score = body.match(/(?:技术)?评分\s*(\d+)\s*分/)?.[1];
      requirements.push({ id: `REQ-${String(requirements.length + 1).padStart(2, "0")}`, category: categoryOf(body, section), requirement: body, mandatory, scoreWeight: score ? Number(score) : undefined, source: source(`DOC-${index + 1}`, name, body, index + 1) });
    }
    if (section.includes("评分") && /分/.test(body)) scoringRules.push({ category: body.split(/[：:]/)[0] || "评分规则", score: body.match(/\d+\s*分/)?.[0] ?? "未明确", description: body, source: source(`DOC-${index + 1}`, name, body, index + 1) });
    if (section.includes("交付") && /完成|提供|支持/.test(body)) deliverables.push(body);
  });
  return { name, content, projectInfo, requirements, scoringRules, deliverables };
}
