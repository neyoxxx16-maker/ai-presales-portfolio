import type { KnowledgeRecord } from "@/types/tender-agent";

const source = (id: string, title: string, excerpt: string, location: string): KnowledgeRecord["source"] => ({ id, title, excerpt, location, category: "演示企业资料" });

export const tenderKnowledge: KnowledgeRecord[] = [
  { id: "Q-ISO9001", category: "qualification", title: "ISO9001 质量管理体系认证（演示）", content: "星云智能科技（演示企业）持有有效 ISO9001 质量管理体系认证，可用于一般项目资格核验。", tags: ["ISO9001", "质量管理", "资质"], source: source("Q-ISO9001", "企业资质清单（Synthetic Demo Data）", "ISO9001 质量管理体系认证：有效。", "qualifications/iso9001.md") },
  { id: "Q-ISO27001", category: "qualification", title: "ISO27001 信息安全管理体系认证（演示）", content: "星云智能科技（演示企业）持有 ISO27001 信息安全管理体系认证。", tags: ["ISO27001", "信息安全", "资质"], source: source("Q-ISO27001", "企业资质清单（Synthetic Demo Data）", "ISO27001 信息安全管理体系认证：有效。", "qualifications/iso27001.md") },
  { id: "Q-YEAR", category: "qualification", title: "企业成立年限说明（演示）", content: "演示企业成立于 2018 年，满足成立三年以上的资格条件。", tags: ["成立年限", "2018", "资质"], source: source("Q-YEAR", "企业基本信息（Synthetic Demo Data）", "成立于 2018 年。", "company-profile/basic.md") },
  { id: "Q-SOFTCOPY", category: "qualification", title: "软件著作权清单（演示）", content: "演示企业拥有企业知识库平台、智能问答与工作流编排相关的软件著作权登记材料。", tags: ["软件著作权", "知识库", "资质"], source: source("Q-SOFTCOPY", "企业资质清单（Synthetic Demo Data）", "软件著作权：企业知识库平台、智能问答相关。", "qualifications/software-copyright.md") },
  { id: "P-RAG", category: "product", title: "企业知识库与 RAG 能力（演示）", content: "支持文档解析、知识分段、检索增强生成、来源引用与答案不足时的人工转交。", tags: ["知识库", "RAG", "文档解析", "来源引用"], source: source("P-RAG", "产品能力白皮书（Synthetic Demo Data）", "支持企业知识库、RAG、文档解析与来源引用。", "products/knowledge-base.md") },
  { id: "P-PRIVATE", category: "product", title: "私有化部署与集成能力（演示）", content: "支持私有化部署、SSO、角色权限控制、日志审计及多模型接入。", tags: ["私有化部署", "SSO", "权限", "日志审计", "多模型"], source: source("P-PRIVATE", "产品能力白皮书（Synthetic Demo Data）", "支持私有化部署、SSO、RBAC 与日志审计。", "products/private-deployment.md") },
  { id: "P-DB", category: "product", title: "国产数据库兼容说明（演示）", content: "已完成部分国产数据库适配验证；特定版本、性能与灾备方案需项目技术确认。", tags: ["国产数据库", "兼容", "部分支持"], source: source("P-DB", "兼容性说明（Synthetic Demo Data）", "国产数据库：部分版本完成适配，需项目确认。", "products/database-compatibility.md") },
  { id: "C-MANU", category: "case", title: "制造行业知识库 POC（演示）", content: "制造行业内部知识助手 POC，覆盖设备手册检索、来源引用和人工复核流程。", tags: ["制造", "知识库", "POC"], source: source("C-MANU", "历史案例库（Synthetic Demo Data）", "制造行业知识库 POC，非生产项目与非真实客户。", "cases/manufacturing-kb.md") },
  { id: "C-RETAIL", category: "case", title: "零售智能客服 POC（演示）", content: "零售场景智能客服 POC，覆盖商品知识检索和风险问题转人工。", tags: ["零售", "客服", "POC"], source: source("C-RETAIL", "历史案例库（Synthetic Demo Data）", "零售智能客服 POC，非生产项目与非真实客户。", "cases/retail-service.md") },
  { id: "D-DELIVERY", category: "delivery", title: "交付与实施能力说明（演示）", content: "可提供需求澄清、试点验证、部署联调、培训交接与验收支持；具体周期以项目范围评估为准。", tags: ["交付", "培训", "实施", "验收"], source: source("D-DELIVERY", "交付能力说明（Synthetic Demo Data）", "可提供 POC、部署联调、培训交接与验收支持。", "company-profile/delivery.md") },
];
