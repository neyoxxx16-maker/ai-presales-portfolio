# AI 售前求职网站｜Phase 3.5 最新交接

> 本文档基于当前仓库 `D:\zm\ai-presales-portfolio-phase2\ai-presales-portfolio` 的实际文件、Git 状态、测试与构建命令生成。不要用旧聊天记录覆盖本文档；后续工作先复核当前 Git 状态。

## 1. 当前项目目标

这是一个面向 **AI 售前 / 解决方案工程师求职** 场景的个人作品集网站。当前最重要的展示项目是：

- **一叶春山 AI 导购 / 客服知识库**：企业知识库、RAG 思路、商品知识检索、需求识别、结构化推荐与来源引用的 POC。
- 当前处于 **Phase 3.5**：将 Phase 3 的演示型 Mock 数据替换为项目资料整理的茶品、SKU、价格证据与来源注册表，并用本地确定性规则实现 Retrieval 和导购逻辑。
- **Phase 4 才讨论**真实 LLM、Embedding、Vector Search、pgvector 或服务端 AI API；在 Phase 3.5 未封板前不得进入 Phase 4。

## 2. 当前技术栈

以 `package.json` 为准：

- Next.js `15.4.6`（App Router）
- React `19.1.0`
- TypeScript `5.7.2`
- Tailwind CSS `3.4.17`
- Lucide React `^0.468.0`
- Node.js 内置 `assert` + `typescript.transpileModule`：现有导购回归测试脚本是 CommonJS，不使用 Jest、Vitest、tsx 或 Playwright。

当前仓库**没有** `app/api/**/route.ts`，也没有实际 Route Handler。`components/tea-demo/TeaChat.tsx` 在客户端直接调用 `lib/tea-response.ts` 的 `buildTeaAnswer()`；这是本地规则 POC，不是后端 API。

## 3. 当前主要页面和目录

页面：

- `/`：首页，入口为 `app/page.tsx`
- `/resume`：在线简历，入口为 `app/resume/page.tsx`
- `/demo/tea-assistant`：一叶春山 AI 导购 Demo，入口为 `app/demo/tea-assistant/page.tsx`

Tea Assistant 重点路径：

- `components/tea-demo/TeaChat.tsx`：聊天输入、调用本地回答逻辑、呈现结果
- `components/tea-demo/ProductRecommendation.tsx`：结构化推荐 SKU 卡片
- `components/tea-demo/SourceList.tsx`：来源引用与面向访客的名称映射展示
- `components/tea-demo/ExecutionPanel.tsx`：可观察的 AI 执行步骤
- `data/tea/products.ts`：正式茶品、SKU、结构化价格证据
- `data/tea/knowledge.ts`：知识块 KB001–KB011
- `data/tea/sources.ts`：内部来源注册表与前台显示名称映射
- `types/tea.ts`：Tea Assistant 类型、intent、实体
- `lib/tea-intent.ts`：规则式意图与实体解析
- `lib/tea-retrieval.ts`：关键词、茶品、SKU、价格证据、知识块检索
- `lib/tea-response.ts`：业务优先级、价格、推荐、对比、兜底回答
- `scripts/test-tea-assistant.cjs`：当前回归测试（注意：不是 `.ts` 文件）

旧 Mock 数据仍在 `data/mock/tea-products.mock.ts`、`data/mock/tea-knowledge.mock.ts`，当前代码未引用它们；正式导购使用 `data/tea/**`。

## 4. 当前 Git 状态

以下为本次交接开始时实际执行 Git 命令得到的状态：

- 当前 branch：`main`
- HEAD 完整 hash：`ac59550f5d9ee9a6a7ff8cb6e478e550f198c0da`
- 短 hash：`ac59550`
- HEAD message：`fix: stabilize phase 3.5 tea assistant logic`
- Author：`xixi`
- Commit 时间：`Mon Aug 31 14:30:17 2026 +0800`
- Remote：`origin` → `https://github.com/neyoxxx16-maker/ai-presales-portfolio.git`（fetch/push）
- 已执行 `git fetch origin`；`origin/main` 与 HEAD 同为 `ac59550...`，本地不领先也不落后。

最近提交：

1. `ac59550 fix: stabilize phase 3.5 tea assistant logic`
2. `3f3ff26 fix: polish knowledge source labels`
3. `58dc03d fix: improve tea assistant recommendation and citations`
4. `94505b0 fix: correct tea SKU pricing rules`
5. `f5bb4a9 data: replace mock tea data with verified knowledge base`
6. `1c27a9a chore: ignore node_modules`
7. `a58a2c8 Initial portfolio version`

### Working tree

工作区 **不 clean**。本次开始检查时，未提交项均为 `.next/**` 生成缓存与 `tsconfig.tsbuildinfo`；其中 `.next` 有大量已跟踪文件的修改/删除/新文件。这不是本轮业务代码改动，但它会影响 `npm run build` 的稳定性。

本交接文件新建后，`AI售前网站_Phase3.5_最新交接.md` 本身也会处于未跟踪状态，等待用户决定是否提交。不要对现有 `.next` 执行 `git reset --hard`、`git clean`、`checkout` 覆盖或 force push。

## 5. 当前 Phase 进度

| Phase | 状态 | 当前实际情况 |
| --- | --- | --- |
| Phase 1 | 已完成 | Next.js 基础工程、首页、Navbar/Footer、Hero、工作方式、项目入口与视觉体系已存在。 |
| Phase 2 | 已完成 | `/resume`、简历 Hero、能力、经历、工具与项目入口已存在。 |
| Phase 3 | 已完成 | `/demo/tea-assistant` 的聊天 UI、执行过程、推荐与来源引用已存在。 |
| Phase 3.5 | 进行中 | 正式知识库、价格规则与 48 条回归测试已存在；但当前 `npm run build` 失败，且有文档/知识块一致性问题。 |
| Phase 4 | 未开始 | 未接真实 LLM、Embedding、Vector Search、向量数据库或真实支付/订单系统。 |

**当前结论：Phase 3.5 尚未封板。**

原因不是核心回归测试失败，而是当前构建失败，且有需要先核对的数据/文档一致性问题，详见第 10、12、14 节。

## 6. 一叶春山真实知识库

### 茶品（`teaProducts`）

| 茶品 | 茶类 | 主要风味 / 信息 |
| --- | --- | --- |
| 明前龙井 | 绿茶 | 栗香、兰花香、鲜爽、回甘 |
| 桂花龙井 | 调味绿茶 | 桂花甜香、龙井兰香、鲜爽、顺滑温润 |
| 龙井红茶 | 红茶 | 蜜香、蜜甜、醇厚、回甘较快；`梅枞天红` 是别名，不是第二种茶 |
| 桂花红茶 | 调味红茶 | 桂花鲜灵清甜、红茶暖香、顺滑、回甘清甜；已知配料含茶鲜叶、桂花 |

### 正式 SKU（`teaSkus`）

| SKU | 规格 / 净含量 | 包装 | 当前结构化价格状态 |
| --- | --- | --- | --- |
| 明前龙井试饮装 | `3g × 2袋` / 共 6g | 试饮装 | ¥9.9 包邮 |
| 明前龙井＋梅枞天红双拼 | `75g + 75g` / 共 150g | 礼盒 | 售价 ¥298 |
| 桂花龙井＋桂花红茶双拼 | `75g + 75g` / 共 150g | 礼盒 | 售价 ¥418 |
| 桂花红茶双盒 | `75g × 2` / 共 150g | 礼盒 | 售价 ¥418 |
| 桂花龙井双盒 | `75g × 2` / 共 150g | 礼盒 | 售价 ¥418 |
| 明前龙井单罐 | 60g / 60g | 单盒 / 单罐装 | 售价 ¥109，划线价 ¥119 |
| 龙井红茶单罐 | 60g / 60g | 单盒 / 单罐装 | 新客价 ¥109，划线价 ¥119 |
| 桂花龙井单罐 | 60g / 60g | 单盒 / 单罐装 | 售价 ¥109，划线价 ¥119 |
| 桂花红茶单罐 | 60g / 60g | 单盒 / 单罐装 | 新客价 ¥109，划线价 ¥119 |

### 仅有价格证据、未建正式 `TeaSku` 的 250g 礼盒

| 商品 | 净含量 | 包装 | 价格证据 |
| --- | --- | --- | --- |
| 龙井红茶礼盒 | 250g | 礼盒 | 新客价 ¥288，划线价 ¥298 |
| 桂花红茶礼盒 | 250g | 礼盒 | 新客价 ¥408，划线价 ¥418 |

严格规则：**6g 试饮装、60g 单罐、150g 双拼/双盒、250g 礼盒是不同 SKU / 价格证据，禁止因数字相同而串价。**

### 当前数据与较早文档的差异

- `data/tea/products.ts` 当前已有三条 ¥418 的 150g 正式记录：桂花双拼、桂花红茶双盒、桂花龙井双盒。
- `data/tea/knowledge.ts` 的 `KB006` 摘要和内容仍使用“**两款 150g 双拼**”表述，没有同步写出两款 ¥418 双盒。因此以 `products.ts` 的结构化 SKU / 价格证据为当前代码事实，KB006 需在下一轮核对后同步。
- README 写“Phase 3.5 完成”，并将“下一阶段”误写为 Phase 3；这与当前构建失败状态不一致。

## 7. 当前价格映射

| 金额 | 价格性质 | SKU / 商品 | 规格与包装 |
| --- | --- | --- | --- |
| ¥9.9 | 售价，包邮 | 明前龙井试饮装 | 3g × 2袋，共 6g，试饮装 |
| ¥109 | 售价 | 明前龙井单罐、桂花龙井单罐 | 各 60g，单罐 |
| ¥109 | 新客价 | 龙井红茶单罐、桂花红茶单罐 | 各 60g，单罐 |
| ¥119 | 划线价 | 四款 60g 单罐 | 对应各自的 ¥109 记录 |
| ¥288 | 新客价 | 龙井红茶礼盒 | 250g，礼盒 |
| ¥298 | 售价 | 明前龙井＋梅枞天红双拼 | 75g + 75g，共 150g，礼盒 |
| ¥298 | 划线价 | 龙井红茶礼盒 | 250g，礼盒；其新客价为 ¥288 |
| ¥408 | 新客价 | 桂花红茶礼盒 | 250g，礼盒 |
| ¥418 | 售价 | 桂花龙井＋桂花红茶双拼、桂花红茶双盒、桂花龙井双盒 | 分别为 150g 双拼或 150g 双盒 |
| ¥418 | 划线价 | 桂花红茶礼盒 | 250g，礼盒；其新客价为 ¥408 |

`lib/tea-response.ts` 现在用 `price.amount` 作为售价/新客价，用 `originalPrice` 作为划线价。价格反查和比较会同时匹配 `amount`、`originalPrice`，并在回答中明确价格类型。

## 8. 当前 Intent / Retrieval 架构

当前 `TeaIntent`（以 `types/tea.ts` 为准）：

- `product_recommendation`
- `product_question`
- `product_fit`
- `product_compare`
- `gift_catalog`
- `product_browse`
- `price_query`
- `price_reverse_lookup`
- `price_compare`
- `price_extreme`
- `quantity_price_calc`
- `brewing_question`
- `brand_question`
- `aftersales`
- `unknown`

### 处理链路

1. `TeaChat` 收集输入，直接调用 `buildTeaAnswer(query)`。
2. `classifyTeaIntent()` 用关键词和正则提取预算、价格金额、数量、场景、包装、茶品、正向风味、硬包含茶类与硬排除条件。
3. `retrieveTeaKnowledge()` 以关键词对 `teaProducts`、`teaSkus`、`teaPriceEvidence`、`teaKnowledge` 打分；不同 intent 允许不同 `knowledgeType`。
4. `buildTeaAnswer()` 在检索结果上按业务优先级生成结构化回答、执行过程、推荐 SKU 和来源知识块。

### 推荐 / 过滤 / 排序

`selectRecommendationSkus()` 的实际顺序：

1. 仅保留已有价格证据的正式 `teaSkus`
2. 硬排除：`excludedProductIds`、`excludedTeaTypes`、`excludedFlavors`、`excludedIngredients`
3. 硬包含：`requiredTeaTypes`（例如“只喝绿茶”允许绿茶与调味绿茶；组合 SKU 要求其中每个茶品均符合）
4. 预算过滤
5. 场景 / 包装过滤
6. 指定茶品过滤
7. 风味偏好加分，再按价格升序；最多返回 3 个 SKU

否定短语支持：`不喜欢`、`不要`、`不想要`、`不喝`、`不考虑`、`不想喝`、`排除`。当前已对“桂花”“红茶”“绿茶”和已知茶品做规则映射，且否定实体不会再被加入正向偏好。

### Fallback 与来源

- 已知结构化问题优先进入价格、数量、比较、推荐等分支，避免宽泛 `unknown` 抢占。
- 医疗功效、隐私、真实订单/支付/物流直接拒答并引用安全边界知识。
- 无资料时返回“没有可以支持的有效信息”，不编造答案。
- `SourceList` 使用 `data/tea/sources.ts` 的前台映射：产品手册、产品参数与使用说明、商品销售页面、商品包装与标签资料、业务资料；不直接显示 S01–S05、`user_confirmed`、`unresolved` 等内部字段。

## 9. 本轮已修复的 Bug

| 项目 | 当前状态 | 当前代码 / 测试依据 |
| --- | --- | --- |
| `298是哪款？` | 已修复 | `price_reverse_lookup`；区分 150g 双拼售价 ¥298 与 250g 礼盒划线价 ¥298。 |
| `418对应哪些产品？` | 已修复 | 反查到桂花双拼、桂花红茶双盒、桂花龙井双盒售价，以及 250g 桂花红茶礼盒划线价。 |
| ¥298 vs ¥288 | 已修复 | `price_compare` 区分双拼售价、250g 礼盒新客价/划线价。 |
| ¥418 vs ¥408 | 已修复 | `price_compare` 区分 150g 售价与 250g 礼盒新客价/划线价。 |
| budget filter | 已修复（测试覆盖） | 预算、`以内/以下`、`块/元` 解析；`我只有100块钱，能买什么？` 通过。 |
| negative preference | 已修复（测试覆盖） | 硬排除优先于预算与排序；“不喜欢桂花，200以内”不推荐桂花 SKU。 |
| `只喝绿茶` | 已修复（测试覆盖） | 只返回明前龙井试饮装 / 单罐与桂花龙井单罐，不返回红茶。 |
| `只要红茶` | 已修复（测试覆盖） | ¥100 内无正式红茶 SKU 时明确无合适项，不返回绿茶。 |
| 最贵 / 最便宜 | 已修复（测试覆盖） | `price_extreme` 只比较售价/新客价，划线价作为补充。 |
| 最贵 / 最便宜礼盒 | 已修复（测试覆盖） | 最便宜礼盒为龙井红茶 250g 新客价 ¥288；最贵礼盒并列 ¥418 的 150g 记录。 |
| 最便宜单罐 | 已修复（测试覆盖） | 四款 60g 单罐并列 ¥109。 |
| quantity × price | 已修复（测试覆盖） | 500 / 600 元买两盒 ¥298 的通用乘法与剩余/超额计算。 |
| product compare | 已修复（测试覆盖） | 桂花龙井/桂花红茶能走 `product_compare`；“更清爽”结论为桂花龙井。 |
| unknown fallback | 部分修复 | 本交接列出的 18 个结构化用例不进入 unknown；尚未覆盖所有自然语言同义表达。 |
| citation source filtering | 已修复（脚本覆盖类型） | 价格用 `sku` 知识、茶品对比用 `tea_type`，并防止回答字符串泄露内部来源词。 |

## 10. 当前仍存在的问题

### 核心阻塞

1. **`npm run build` 当前失败**：执行到 `Collecting page data ...` 后报 `PageNotFoundError: Cannot find module for page: /_document`。当前工作区 `.next` 有大量已跟踪生成物的修改/删除，极可能与此相关；本轮未删除或清理缓存，以免越权覆盖现有文件。

### 数据与文档一致性

2. `data/tea/knowledge.ts` 的 `KB006` 尚未同步两款 ¥418、75g×2、150g 双盒；但 `products.ts` 已将两款双盒设为正式结构化价格证据。
3. 250g 龙井红茶 / 桂花红茶礼盒仅存在于 `teaPriceEvidence`，没有对应 `TeaSku`。因此价格问答、反查与极值能正确回答，但商品浏览、推荐卡片不会把这两个 250g 礼盒作为正式 SKU 返回。
4. README 阶段状态滞后：它写“Phase 3.5 完成”，并把下一阶段写成 Phase 3；应在确认封板后再同步。

### 规则系统边界

5. 当前是关键词/正则确定性规则，不是 LLM：未覆盖的同义句、复杂多轮上下文、复合否定、复杂中文数量表达仍可能落入非预期 intent。
6. 价格反查的商品卡片只会展示存在 `TeaSku` 绑定的记录；250g 礼盒会在自然语言答案中出现，但不会出现 SKU 卡片。
7. 当前测试只验证逻辑返回的来源 `knowledgeType` 与回答不泄露内部词；没有独立的浏览器 E2E 测试脚本验证所有来源展开交互。

### 页面路由

8. 实际 `app/` 中仅有 `/`、`/resume`、`/demo/tea-assistant`。Navbar 已存在 `/demo/ecommerce-agent`、`/solutions`、`/about` 链接，但对应 App Router 页面当前不存在，属于现有死链接风险（不属于本轮业务逻辑改动）。

## 11. 当前测试情况

当前测试文件实际为 `scripts/test-tea-assistant.cjs`，执行命令：

```bash
npm run test:tea
```

本次实际结果：

- 总数：48
- 通过：48
- 失败：0
- 输出：`Tea assistant regression: 48/48 passed`

以下重点用例均在当前脚本中并已通过：

1. `298是哪款？`
2. `418对应哪些产品？`
3. `298和288有什么区别？`
4. `418和408有什么区别？`
5. `我只有100块钱，能买什么？`
6. `预算120，只喝绿茶`
7. `不喜欢桂花，200以内`
8. `我不喜欢红茶，预算500送礼`
9. `我只要红茶，100元以内`
10. `桂花龙井和桂花红茶有什么区别？`
11. `桂花红茶和桂花龙井哪个更清爽？`
12. `最贵的是哪个？`
13. `最便宜的是哪个？`
14. `最便宜的礼盒是哪款？`
15. `最贵的礼盒是哪款？`
16. `最便宜的单罐是哪款？`
17. `500块可以买两盒298的吗？`
18. `600块可以买两盒298的吗？`

## 12. Build 状态

本次实际执行：

```bash
npm run build
```

结果：**失败**。

已完成阶段：

- `Compiled successfully`
- `Linting and checking validity of types`

失败阶段与原始错误：

```text
Collecting page data ...
unhandledRejection [Error [PageNotFoundError]: Cannot find module for page: /_document] {
  type: 'PageNotFoundError',
  code: 'ENOENT'
}
```

因此本次没有 TypeScript 报错，但不能写“build 成功”。下一窗口应先安全诊断 `.next` 被跟踪/缓存不一致问题；在得到用户明确授权前，不要使用 destructive Git 命令。

## 13. 数据和安全边界

- 不接真实支付、库存、订单或物流。
- 不查询、披露或修改真实消费者隐私。
- 不声称系统已作为品牌生产系统上线。
- 不编造准确率、业务效果、性能数据或医疗功效。
- `.env`、`.env.local`、API Key 均不得提交。
- 前台不得显示内部 `sourceId`、`S01`–`S05`、`user_confirmed`、`user_confirmed_business_rule`、`unresolved`、placeholder 或开发过程措辞。
- 内部来源元数据可以保留在 `data/tea/sources.ts`、`products.ts`、`knowledge.ts`；`SourceList` 应继续只使用对访客友好的显示映射。

## 14. Phase 3.5 封板标准

封板前至少满足：

1. `npm run test:tea` 全部通过。
2. `npm run build` 成功，且 TypeScript 无报错。
3. 价格、推荐、负向偏好、硬茶类筛选、比较、数量计算与 unknown fallback 的核心验收持续通过。
4. 结构化 `products.ts`、`knowledge.ts`、README 的价格与阶段说明同步，无矛盾。
5. 工作区生成物问题有明确、安全的处理方案；提交中不包含 `.env`、API Key、node_modules 或不必要的 `.next` 产物。
6. 浏览器端来源引用不泄露内部元数据，关键页面无控制台错误。

**当前判断：Phase 3.5 尚未封板。** 虽然 48/48 逻辑测试通过，但 build 失败且第 10 节的数据/文档一致性问题尚未处理。

## 15. 下一窗口第一步该做什么

不要进入 Phase 4。建议按以下顺序继续 Phase 3.5：

1. 先读取本文档，执行 `git status --short --branch`，确认 `.next` / `tsconfig.tsbuildinfo` 的真实状态和是否仍有 build 缓存损坏。
2. 在不使用 `git reset --hard`、`git clean`、force push 的前提下，诊断 `PageNotFoundError: Cannot find module for page: /_document` 的根因；先确认 `.gitignore` 与 `.next` 是否被错误跟踪，再决定是否需要用户授权处理生成缓存。
3. 修复 build 后，重新运行 `npm run test:tea` 与 `npm run build`。
4. 核对并同步 `KB006`、`products.ts`、README：明确三条 ¥418 的 150g 记录，并决定是否将两个 250g 礼盒建为正式 `TeaSku`，或明确其只用于价格证据。
5. 再做一轮浏览器验收：`/`、`/resume`、`/demo/tea-assistant`，以及 Navbar 当前死链接的处理范围。
6. 仅在以上全部稳定后，才讨论 Phase 3.5 封板；封板前不讨论 Phase 4 实现。

## 16. 给下一 ChatGPT 窗口的启动指令

> 按仓库根目录的《AI售前网站_Phase3.5_最新交接.md》继续，不要从零重写，也不要初始化新项目。以当前 Git 仓库、当前代码和交接文档为准。先确认 `.next` 导致的 build 失败及 Phase 3.5 数据/文档一致性问题，继续完成最终逻辑验收。Phase 3.5 未稳定、测试与 build 未同时通过前，不要进入 Phase 4；不要接真实 LLM、Embedding、Vector Search 或向量数据库。
