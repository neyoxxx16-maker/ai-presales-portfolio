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

## Phase 4.0｜Grounded RAG MVP

Tea Assistant 保留 Phase 3.5 的结构化业务引擎作为 SKU、价格、预算、数量计算与安全边界的事实层和 fallback。非结构化知识由本地开源 Sentence Transformers 模型生成 embedding，写入本地 JSON 向量索引，并以 cosine similarity 取 Top-K；仅在服务端使用 DeepSeek 生成带引用的自然回答。模型输出经过结构化事实、引用和价格校验；缺少 DeepSeek 密钥、索引、检索不足、Local Embedding 或 Provider 失败时，自动回退到 Phase 3.5 本地规则结果。

将 DeepSeek 配置放入 `.env.local`：`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL=https://api.deepseek.com` 与 `DEEPSEEK_MODEL=deepseek-v4-flash`。安装本地 embedding 运行时后，运行 `python -m pip install -r scripts/requirements-local-embeddings.txt`，再运行 `npm run build:tea-index` 离线预生成向量索引。模型权重只保存在本机缓存，生成的索引和密钥均不会进入 Git 或浏览器。

## 当前阶段

Phase 4.0 尚未封板：仍需在配置真实 `DEEPSEEK_API_KEY` 后完成 Live RAG 验证。
