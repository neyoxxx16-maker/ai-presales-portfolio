# AI 售前作品集架构 V2

> 本文是新版架构的唯一可信来源。Demo2 已由 **AI 电商内容生成 Agent** 调整为 **AI 招投标与方案生成 Agent**；此前涉及电商内容生成、营销审核与其数据流的设计均为 Deprecated，不再代表线上实现。

## 1. 产品形态与页面

| 页面 | 当前能力 |
| --- | --- |
| `/demo/tea-assistant` | 一叶春山 AI 导购知识库 POC；独立茶叶资料空间和 RAG 链路。 |
| `/demo/tender-agent` | 招投标分析工作台；Sample 与 PDF / DOCX / TXT / Markdown 输入、真实文本解析、需求提取、Planner、工具调用、偏离分析、技术响应建议与人工复核。 |
| `/resume` 与首页 | 同步展示两个真实可进入的项目入口。 |

## 2. Tender Agent 数据流

```text
Tender File
  ↓
Document Parser → OCR Interface（当前未配置真实 OCR）
  ↓
Requirement Extraction
  ↓
Agent Planner（DeepSeek Structured JSON / Rule Fallback）
  ↓
Tool Registry
  ├─ search_company_qualification
  ├─ search_product_capability
  ├─ search_historical_cases
  ├─ search_external_web（可选，当前未配置）
  └─ check_requirement_match
  ↓
Deviation Analysis → Risk Assessment → Solution Response → Human Review → Export（后续增强）
```

## 3. Agent 与规则边界

`lib/tender-agent/planner.ts` 将招标正文视为不可信输入。系统提示明确禁止遵循文档中的指令注入文字；模型只能从允许列表中选择工具。配置 DeepSeek 时，模型返回结构化 JSON Planner；服务端验证工具名并补足解析、提取、匹配和生成等可审计步骤。未配置或失败时回退到规则 Planner。

`lib/tender-agent/orchestrator.ts` 执行工具并生成前端可展开的执行记录。记录包含工具名、用途、输入摘要、结果摘要、来源、状态和耗时，刻意不显示 Chain-of-Thought。

规则代码负责状态映射、硬性条件、匹配度和风险等级；模型只负责可选任务规划。总体匹配度按 `PASS=1 / PARTIAL=0.5 / UNKNOWN=0.25 / MISSING=0` 对要求条数加权计算，页面同步展示公式，不能由模型自由生成。

## 4. 数据与 RAG 隔离

`data/tea/**` 与 Demo1 的向量检索仍保持原用途。Demo2 的独立演示企业资料在 `data/tender/knowledge.ts`，包含企业资质、产品能力、历史案例与交付能力。当前通过 `ToolRegistry` 使用可追溯的关键词 retrieval 返回统一 `{ tool, query, results, sources, confidence, status }`；没有复制茶叶业务 RAG，也不读取茶叶资料。

所有 Demo2 企业、资质、案例和描述都是 **Synthetic Demo Data / POC 示例**。不包含真实客户、中标、生产部署、准确率或成本节省声明。

## 5. POC 与失败用例

`scripts/test-tender-agent.cjs` 覆盖十类场景：正常文本、资料不足、硬性条件未知、多技术要求、资料适配边界、无法确认能力、Prompt Injection、LLM 不可用、空文件和 OCR 文本转写 fallback。结果使用 PASS / FAIL / NEEDS_REVIEW 的语义：测试脚本会在断言失败时退出；前端的 UNKNOWN / PARTIAL / MISSING 表示待人工处理而非通过。

## 6. Phase 5–7

### Phase 5：AI 招投标与方案生成 Agent

已实现基础闭环：Sample / 文本输入、文件解析、需求抽取、Planner、Tool Registry、演示企业知识库、资格/能力/案例检索、Requirement Match、偏离分析、风险、技术响应建议、Tool Call 可视化和 Human Review。OCR、真实 Web Search、PDF/Word 二进制解析与导出仍是明确的后续接口边界。

### Phase 6：证据链 + POC + 方案表达

计划补充两项目架构图、可视化数据流、正式 POC 测试报告、失败用例展示、项目复盘、演示脚本和可选方案 / PPT 大纲输出。

### Phase 7：部署与最终验收

计划完成 GitHub / Vercel / 域名、生产构建、响应式、环境变量、错误处理与公网验收；验收需覆盖 Demo1、Tender Agent、Sample、文件解析、来源、Tool Calling 和文档一致性。
