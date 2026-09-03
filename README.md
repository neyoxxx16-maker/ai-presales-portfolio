# 黄念红 · AI 售前解决方案作品集

面向 AI 售前 / 解决方案工程师求职场景的个人能力展示网站。项目以可运行 Demo、来源证据、POC 测试和明确边界来呈现方案能力。

## 当前项目

- `/demo/tea-assistant`：一叶春山 AI 导购 / 客服知识库 POC。保留独立的茶叶数据空间、结构化业务规则与可选 Live RAG。
- `/demo/tender-agent`：AI 招投标与方案生成 Agent。支持文档解析、按需 OCR、Hybrid RAG、企业资料检索、Tavily 外部核验、Evidence 与 Agent Trace，并输出资格检查、评分 / 风险分析与投标建议。
- `/solutions`：方案展示页，呈现 POC、方案方法论、技术架构、业务判断、ROI、复盘与独立业务材料。

Demo2 已从“AI 电商内容生成 Agent”调整为“AI 招投标与方案生成 Agent”；旧电商 Agent 路由、接口、组件、类型、工具和测试已移除。

## Demo2 工作流

`Tender File → Document Parser / OCR → Requirement Extraction → Hybrid RAG → Agent Planner → Tool Registry → Evidence → Requirement Match → Risk / Score Analysis → Solution Response → Human Review`

Planner 在配置 `DEEPSEEK_API_KEY` 时调用 DeepSeek 生成受限的 JSON 工具规划；未配置或调用失败时，自动采用同样可审计的规则化 Planner。前端没有模拟工具调用：执行记录来自服务端真实调用的解析、检索、匹配和响应生成步骤。

内部资料位于 `data/tender/knowledge.ts`，逻辑上与 `data/tea/**` 完全隔离，且全部标注为 **Synthetic Demo Data**。Tender 资料库使用关键词与向量检索经 RRF 融合的 Hybrid RAG；茶叶向量索引仍只服务 Demo1，未混用数据空间。

## 本地运行与验证

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`，Demo2 为 `http://localhost:3000/demo/tender-agent`。

```bash
npm run test:tea
npm run test:rag
npm run test:tender
npm run build
```

## 环境变量与边界

将服务端密钥放入 `.env.local`，只提交 `.env.example`。严禁使用 `NEXT_PUBLIC_DEEPSEEK_API_KEY`。DeepSeek 失败时 Tender Agent 继续运行 Sample / 规则 Planner 回退，不暴露密钥或原始错误。

- TXT / Markdown：直接读取正文。
- DOCX：通过 Mammoth 提取标题、段落、列表与表格文字。
- 文本型 PDF：通过 PDF 文本提取；扫描 PDF 在配置 OCR Provider 后可进入真实 OCR 流程，未配置时明确标记为不可用，不生成假文本。

## 真实企业资料库（本地运行时）

`/demo/tender-agent` 可切换至“真实企业资料”，并在“我方资料”中导入 PDF、DOCX、TXT、Markdown、PNG、JPG 或 JPEG。资料、提取文本和本地索引仅保存于 `storage/tender-company/`，该目录已加入 `.gitignore`，请勿提交公开仓库。未配置语义检索或 OCR Provider 时，页面会明确显示关键词检索降级或 OCR 未启用状态。
- Web Search：配置 `TAVILY_API_KEY` 后通过 `search_external_web` 进行外部公开信息补充与核验；未配置时显示“未配置”，不会用外部信息判断企业内部资质。
- 所有匹配结论、案例和企业资料都是 POC 演示。最终投标、资格有效性、承诺、案例证明和风险接受必须由人工确认。

## Data & Privacy

本仓库为 AI 售前作品集公开展示版本，仅包含 Demo 数据、脱敏项目资料、架构与业务设计及 POC 工程代码。真实企业原始资料、用户上传文件、API Key 与敏感配置不存储在公开仓库中。

项目开发采用 AI-assisted development；本人主要负责需求分析、方案设计、Agent / RAG 工作流设计、交互设计、测试验收与项目迭代。

当前项目交接见 [AI售前网站_当前项目最新交接_2026-09-02.md](AI售前网站_当前项目最新交接_2026-09-02.md)。
