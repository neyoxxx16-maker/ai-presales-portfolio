import manifest from "@/data/tender/company-demo/manifest.json";
import profile from "@/data/tender/company-demo/company-profile.json";
import qualifications from "@/data/tender/company-demo/qualifications.json";
import personnel from "@/data/tender/company-demo/personnel.json";
import cases from "@/data/tender/company-demo/cases.json";
import capabilities from "@/data/tender/company-demo/capabilities.json";
import delivery from "@/data/tender/company-demo/delivery.json";
import afterSales from "@/data/tender/company-demo/after-sales.json";
import type { EvidenceStatus, KnowledgeRecord } from "@/types/tender-agent";

type Raw = Record<string, unknown>;
const root = "data/tender/company-demo";
const text = (value: unknown) => Array.isArray(value) ? value.join("、") : String(value ?? "");
const source = (id: string, title: string, content: string, sourceFile: string): KnowledgeRecord["source"] => ({ id, title: `${id} · ${title}`, excerpt: content.slice(0, 100), location: `${root}/${sourceFile}`, category: "演示企业资料" });
function record(category: KnowledgeRecord["category"], item: Raw, content: string, sourceFile: string): KnowledgeRecord {
  const id = String(item.id); const title = String(item.name);
  return { evidenceId: id, id, category, title, content, tags: (item.keywords as string[] | undefined) ?? [], sourceFile, status: (item.status as EvidenceStatus | undefined) ?? "valid", validFrom: String(item.validFrom || "") || undefined, validTo: String(item.validTo || "") || undefined, synthetic: true, source: source(id, title, content, sourceFile) };
}

const qualificationRecords = (qualifications as Raw[]).map((item) => record("qualification", item, `${item.name}；状态：${item.status}；有效期：${item.validFrom || "未提供"} 至 ${item.validTo || "长期/未提供"}；适用范围：${item.scope || "未提供"}。`, "qualifications.json"));
const personnelRecords = (personnel as Raw[]).map((item) => record("personnel", item, `${item.name}，${item.role}，${item.experienceYears}年经验；证书：${text(item.certifications) || "未提供"}；能力：${text(item.skills)}。`, "personnel.json"));
const caseRecords = (cases as Raw[]).map((item) => record("case", item, `${item.name}；行业：${item.industry}；规模：${item.amount}；内容：${text(item.content)}；验收：${item.acceptance}；同类判断：${item.similarity}。`, "cases.json"));
const capabilityRecords = (capabilities as Raw[]).map((item) => record("product", item, `${item.description} 状态：${item.status}。`, "capabilities.json"));

export const tenderKnowledge: KnowledgeRecord[] = [
  record("company", profile as Raw, `${profile.name}，成立于 ${profile.establishedAt}；主营：${profile.focus.join("、")}。`, "company-profile.json"),
  ...qualificationRecords, ...personnelRecords, ...caseRecords, ...capabilityRecords,
  record("delivery", delivery as Raw, `覆盖阶段：${delivery.stages.join("、")}；治理：${delivery.governance.join("、")}。`, "delivery.json"),
  record("after-sales", afterSales as Raw, `${afterSales.support}；服务：${afterSales.services.join("、")}。`, "after-sales.json"),
];

export const companyLibraryOverview = {
  label: manifest.label, notice: manifest.notice, company: profile.name,
  sections: [["公司资料", 1], ["企业资质", qualificationRecords.filter((item) => item.status !== "missing").length], ["项目成员", personnelRecords.length], ["历史案例", caseRecords.length], ["产品能力", capabilityRecords.length], ["实施交付", 1], ["售后服务", 1]] as Array<[string, number]>,
};
export function recordsByCategory(category: KnowledgeRecord["category"]) { return tenderKnowledge.filter((item) => item.category === category); }
