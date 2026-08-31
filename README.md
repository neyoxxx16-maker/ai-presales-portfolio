# 黄念红 · AI 售前解决方案作品集

面向 AI 售前 / 解决方案工程师求职场景的个人能力展示网站。项目以可运行 Demo、来源证据、POC 测试和明确边界来呈现方案能力。

## 当前项目

- `/demo/tea-assistant`：一叶春山 AI 导购 / 客服知识库 POC。保留独立的茶叶数据空间、结构化业务规则与可选 Live RAG。
- `/demo/tender-agent`：AI 招投标与方案生成 Agent。读取招标文件，提取要求，让 Planner 选择内部检索工具，并输出资格检查、偏离分析、风险与技术响应建议。

Demo2 已从“AI 电商内容生成 Agent”调整为“AI 招投标与方案生成 Agent”；旧电商 Agent 路由、接口、组件、类型、工具和测试已移除。

## Demo2 工作流

`Tender File → Document Parser → Requirement Extraction → Agent Planner → Tool Registry → Requirement Match → Deviation Analysis → Risk Assessment → Solution Response → Human Review`

Planner 在配置 `DEEPSEEK_API_KEY` 时调用 DeepSeek 生成受限的 JSON 工具规划；未配置或调用失败时，自动采用同样可审计的规则化 Planner。前端没有模拟工具调用：执行记录来自服务端真实调用的解析、检索、匹配和响应生成步骤。

内部资料位于 `data/tender/knowledge.ts`，逻辑上与 `data/tea/**` 完全隔离，且全部标注为 **Synthetic Demo Data**。当前检索使用独立、可追溯的关键词 retrieval；茶叶向量索引仍只服务 Demo1，未混用数据空间。

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

- TXT / Markdown：当前真实解析。
- PDF / Word / 扫描文件：已保留 OCR Tool Interface；当前未接入解析服务，建议导出文本或使用 Sample 文件。不得宣称为真实 OCR。
- Web Search：已预留 `search_external_web` adapter；未配置 provider 时显示“未配置”，不会用外部信息判断企业内部资质。
- 所有匹配结论、案例和企业资料都是 POC 演示。最终投标、资格有效性、承诺、案例证明和风险接受必须由人工确认。

详细架构与 Phase 5–7 计划见 [docs/ARCHITECTURE_V2.md](docs/ARCHITECTURE_V2.md)。
