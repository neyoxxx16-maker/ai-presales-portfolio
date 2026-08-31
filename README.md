# 黄念红 · AI售前解决方案作品集

一个面向 AI售前 / 解决方案工程师 求职场景的个人能力展示网站。

## 当前进度

- Phase 1：项目初始化 + 基础框架 + 首页视觉完成
- Phase 2：在线简历页完成
- Phase 3：一叶春山 AI 导购交互 POC 完成
- Phase 3.5：Verified Project Knowledge Base 与最终逻辑验收进行中

## 技术栈

- Next.js
- TypeScript
- Tailwind CSS
- Lucide Icons
- Vercel（后续部署）

## 本地运行

```bash
npm install
npm run dev
```

打开：`http://localhost:3000`

## 设计方向

参考用户提供的 Aeline 风格截图，不做一比一复制，保留以下设计语言：

- 大面积留白
- 蓝天感 Hero
- 黑白为主、荧光黄绿少量点缀
- 大圆角卡片
- 极简咨询 / AI SaaS 气质
- 中文信息架构

## 已完成页面

- `/` 首页
- `/resume` 在线简历

## Phase 3.5｜Verified Project Knowledge Base

Phase 3 使用本地 Mock 数据验证 UI 与交互。Phase 3.5 已将旧 Mock 商品数据隔离至 `data/mock/`，并根据项目已有产品手册、产品参数、销售页面截图、包装资料和用户确认口径，整理了茶品、SKU、价格证据、来源注册表与可追溯知识块。

该知识库属于个人作品集 POC，不是品牌生产系统；不连接真实支付、库存、订单、物流或客户隐私数据。

## Phase 4.0｜Hybrid RAG MVP

Tea Assistant 保留 Phase 3.5 的结构化业务引擎来确定 SKU、价格、预算、数量计算与安全边界；对风味、冲泡、品牌和推荐理由等非结构化知识，服务端可使用本地 JSON 向量索引、cosine similarity 和真实 LLM 生成带引用的自然回答。模型输出经过结构化事实与引用校验；缺少密钥、索引、检索不足或 Provider 失败时，自动回退到 Phase 3.5 本地规则结果。

配置 `.env` 后运行 `npm run build:tea-index` 建立本地向量索引。`.env.example` 仅提供变量模板，密钥不会进入浏览器或 Git。

## 当前阶段

继续完成 Phase 3.5 的逻辑验收、自动化回归与构建验证。在这些检查全部稳定前，不进入下一阶段。
