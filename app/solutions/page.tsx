import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, FileSearch, FileText, FlaskConical, Layers3, MessageSquareText, SearchCheck, Workflow } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { SolutionAnchorNav } from "@/components/solutions/SolutionAnchorNav";
import { SolutionDeliveryCenter } from "@/components/solutions/SolutionDeliveryCenter";
import { siteConfig } from "@/lib/site-config";

const featuredCases = [
  { title: "一叶春山 AI 导购 / 知识服务 POC", label: "知识服务 POC", icon: MessageSquareText, scenario: "选茶推荐、产品问答与售后分流", problem: "SKU 与产品资料分散，人工客服需要反复查找；客户需要的是有依据的推荐，而不只是 FAQ。", solution: "将商品资料整理为可检索、可解释、可追溯的知识服务，并以规则约束推荐范围。", work: "需求场景拆解、知识边界设计、交互 Demo 与 POC 验证。", href: "/demo/tea-assistant", action: "体验 AI 导购" },
  { title: "AI 招投标与方案生成 Agent", label: "多步骤 Agent POC", icon: FileSearch, scenario: "招标文件解析、企业资料检索、资格与风险审查", problem: "长文件中资格、评分与风险信息分散，售前需要先判断能不能投、缺什么、风险在哪里。", solution: "将解析、检索、资格匹配、风险分析与 Evidence 组织成可复核工作流。", work: "需求与验收口径定义、工作流设计、工具路径与 POC 测试。", href: "/demo/tender-agent", action: "体验 Agent" },
] as const;

const problemToPoc = [
  { title: "AI 导购", problems: ["SKU 与产品资料分散", "人工客服重复查询", "用户需要推荐而非普通 FAQ"], judgment: "不是缺一个聊天框，而是缺一个可检索、可解释、可追溯的知识服务。", focus: ["RAG 检索", "推荐边界", "来源引用", "多轮问答"] },
  { title: "招投标 Agent", problems: ["招标文件长", "资格、评分、风险信息分散", "人工审查耗时", "资料缺失难以及时发现"], judgment: "不是简单 PDF 摘要，而是一个多步骤判断与证据组织流程。", focus: ["OCR", "Hybrid RAG", "企业资料检索", "资格判断", "Evidence", "Agent Trace"] },
] as const;

const methodSteps = [
  ["需求澄清", "确认客户真正想解决的问题和边界。"], ["场景拆解", "将大问题拆成具体任务与流程。"], ["能力映射", "判断何时使用 RAG、Agent、OCR 或 Web Search。"], ["方案设计", "形成系统架构、数据流与产品交互。"], ["POC", "先验证关键链路是否可行。"], ["验证", "通过测试用例与失败场景检查结果。"], ["优化", "针对检索、流程与降级路径持续调整。"], ["交付 / 复盘", "沉淀材料、边界与下一步判断。"],
] as const;

const comparisons = [
  { title: "RAG vs 微调", conclusion: "产品知识与招标信息会更新，当前项目优先以 RAG 获取可更新、可追溯的知识，而不通过微调固化事实。", columns: ["RAG", "微调"], rows: [["知识更新", "更新资料后可重建索引", "需重新训练"], ["数据量要求", "适合当前资料规模", "通常需要更稳定的训练数据"], ["成本", "以检索与调用成本为主", "需要训练与迭代成本"], ["适用", "动态私有知识", "固定行为或风格模式"]] },
  { title: "关键词 vs 向量 vs Hybrid RAG", conclusion: "招投标文件既有硬性专业关键词，也有自然语言条款；当前项目用 Hybrid RAG 兼顾精确命中与语义召回。", columns: ["关键词", "向量", "Hybrid RAG"], rows: [["精确关键词", "强", "一般", "强"], ["语义召回", "有限", "强", "强"], ["中文长文档", "依赖词面", "依赖语义相近", "同时覆盖"], ["稳定性", "规则清晰", "需关注相似但无关", "以融合结果降低单一路径偏差"]] },
  { title: "纯生成 vs RAG + Evidence", conclusion: "售前与招投标场景不能只给答案，还需要说明答案依据；因此关键结论尽可能绑定检索来源与执行轨迹。", columns: ["纯大模型生成", "RAG + Evidence"], rows: [["回答依据", "难以向用户解释", "可回看来源"], ["可追溯性", "有限", "保留 Evidence / Trace"], ["幻觉风险", "需要额外控制", "以检索资料约束回答"], ["客户沟通", "更像结论", "可展示判断过程"]] },
] as const;

const architectures = [
  { title: "AI 导购数据流", icon: Layers3, nodes: ["用户提问", "意图识别", "Knowledge Search", "Hybrid Retrieval", "生成回答", "Evidence", "Response"], highlights: ["Evidence"] },
  { title: "招投标 Agent 数据流", icon: Workflow, nodes: ["文件上传", "文件解析 / OCR", "文本切分", "Hybrid RAG", "企业资料", "Web Search", "Agent Analysis", "Evidence", "最终报告"], highlights: ["Evidence", "Agent Analysis"] },
] as const;

const decisions = [
  ["为什么采用 Hybrid RAG？", "关键词检索擅长精准命中，向量检索擅长语义召回；招投标文档同时存在专业关键词与自然语言条款，因此使用融合检索。"],
  ["为什么区分演示与真实企业资料？", "Demo 环境不需要上传敏感资料；真实资料入口模拟客户部署流程，并保持资料与演示数据隔离。"],
  ["为什么增加 Evidence？", "招投标属于高可信要求场景，用户不仅需要结论，也需要知道结论来自哪里。"],
  ["为什么增加 Agent Trace？", "让用户理解工具调用路径，同时方便调试多步骤任务与解释复杂执行过程。"],
] as const;

const retrospectives = [
  { title: "项目切换后残留上一份文件的上下文", root: "会话、分析结果与当前项目文件需要一起切换，单独保留会造成上下文混淆。", solution: "新建或替换项目时重新初始化当前会话、分析结果与文件状态；历史内容保存在对应项目中。", result: "当前项目记录按项目 ID 隔离，回归测试覆盖文件、分析、对话、Evidence 与 Trace 的恢复。", learning: "多轮 Agent 产品中，状态管理与业务上下文隔离和模型能力同样重要。" },
  { title: "首次分析与后续问答混在同一入口", root: "上传文件后的首轮任务和完成分析后的追问，属于不同用户任务。", solution: "保留独立的“开始分析”入口；分析完成后再开启基于当前结果的连续问答。", result: "首次分析不依赖额外问题，后续问题复用当前项目的分析结果与 Trace。", learning: "Agent 交互要按用户任务路径设计，而不仅是按技术调用链排列。" },
  { title: "联网检索或 OCR 不能保证始终可用", root: "外部 Provider、密钥和文件类型都会影响工具调用。", solution: "保留 Tool fallback、错误状态和来源标注；未配置时不伪造 OCR 文本或联网结论。", result: "回归测试覆盖 OCR 与 Web Search 的未配置、失败和降级路径。", learning: "Agent 的可用性还取决于工具失败时如何清晰退化。" },
  { title: "单一检索路径并不总能命中业务相关资料", root: "词面精确匹配与语义相似召回各有盲区。", solution: "组合 keyword retrieval、vector retrieval 与 RRF fusion，形成 Hybrid RAG。", result: "检索路径与降级信息会进入 Evidence / Trace，而不是只输出一个无来源结论。", learning: "检索质量需要与业务判断标准一起设计，而非只看语义相似度。" },
] as const;

const alternatives = [
  { title: "AI 导购：从客服工具到知识服务", columns: ["人工客服", "传统 FAQ / 关键词机器人", "通用大模型", "RAG AI 导购"], rows: [["私有知识", "靠人工查找", "依赖预设问答", "默认不具备", "以项目资料检索"], ["推荐能力", "依赖人员经验", "规则有限", "可能无依据", "结合需求与商品资料"], ["知识更新", "培训与同步", "人工维护词条", "需补充上下文", "更新资料与索引"], ["来源可追溯", "人工说明", "较有限", "较有限", "展示命中资料"]] },
  { title: "招投标：不只是“把 PDF 丢给模型总结”", columns: ["人工阅读", "PDF 摘要工具", "通用大模型上传文件", "招投标 Agent"], rows: [["资格项识别", "人工核对", "不保证结构化", "依赖提示", "拆分并匹配 Evidence"], ["评分规则", "人工整理", "可能遗漏", "依赖提示", "提取后进入分析"], ["企业资料匹配", "人工查库", "通常不支持", "需手动提供", "内部资料检索"], ["多步骤与 Trace", "人工过程", "通常无", "不透明", "工具调用路径可查看"]] },
] as const;

function SectionHeading({ index, title, description, dark = false }: { index: string; title: string; description: string; dark?: boolean }) {
  return <div className="max-w-4xl"><p className={dark ? "text-[11px] font-semibold tracking-[0.18em] text-white/45" : "section-kicker"}>{index}</p><h2 className={`mt-5 text-4xl font-medium leading-[1.1] tracking-[-0.045em] sm:text-5xl ${dark ? "text-white" : ""}`}>{title}</h2><p className={`mt-6 max-w-3xl text-sm leading-7 ${dark ? "text-white/60" : "text-neutral-500"}`}>{description}</p></div>;
}

function InlineFlow({ nodes, highlights = [] }: { nodes: readonly string[]; highlights?: readonly string[] }) {
  return <div className="mt-7 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-1.5">{nodes.map((node, index) => <div key={node} className="contents"><span className={`inline-flex min-h-9 items-center rounded-xl border px-3 py-2 text-xs font-medium leading-5 ${highlights.includes(node) ? "border-[#b8e95a] bg-[#efffd0] text-neutral-950" : "border-black/5 bg-white text-neutral-600"}`}>{node}</span>{index < nodes.length - 1 && <ArrowRight aria-hidden="true" className="ml-2 rotate-90 text-neutral-300 md:ml-0 md:rotate-0" size={14} />}</div>)}</div>;
}

function ComparisonTable({ title, columns, rows, conclusion, dark = false }: { title: string; columns: readonly string[]; rows: readonly (readonly string[])[]; conclusion?: string; dark?: boolean }) {
  return <article className={`overflow-hidden rounded-[24px] border ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-white"}`}><div className={`border-b p-5 ${dark ? "border-white/10" : "border-black/5"}`}><h3 className="text-lg font-medium">{title}</h3>{conclusion && <p className={`mt-2 text-xs leading-6 ${dark ? "text-white/60" : "text-neutral-500"}`}>{conclusion}</p>}</div><div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className={dark ? "bg-white/5 text-white/55" : "bg-[#f7f8f9] text-neutral-500"}><tr><th className="min-w-[96px] px-5 py-3 font-medium">维度</th>{columns.map((column) => <th key={column} className="min-w-[132px] px-5 py-3 font-medium">{column}</th>)}</tr></thead><tbody className={dark ? "divide-y divide-white/10 text-white/75" : "divide-y divide-black/5 text-neutral-600"}>{rows.map(([dimension, ...values]) => <tr key={dimension} className={dark ? "transition-colors hover:bg-white/5" : "transition-colors hover:bg-[#f7ffe8]"}><th className={`px-5 py-3.5 font-medium ${dark ? "text-white" : "text-neutral-800"}`}>{dimension}</th>{values.map((value, index) => <td key={`${dimension}-${index}`} className="px-5 py-3.5 leading-5">{value}</td>)}</tr>)}</tbody></table></div></article>;
}

export default function SolutionsPage() {
  return <main>
    <Navbar />
    <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 lg:px-8 lg:pb-20 lg:pt-24">
      <p className="section-kicker">Presales Solution Workflow</p>
      <h1 className="mt-5 max-w-5xl text-5xl font-medium leading-[1.08] tracking-[-0.055em] sm:text-6xl lg:text-7xl">从需求到落地的售前方案能力</h1>
      <p className="mt-8 max-w-3xl text-base leading-8 text-neutral-500">从客户需求澄清，到技术方案设计、POC 验证和价值评估，展示我如何将 AI 能力转化为可落地的业务方案。</p>
    </section>
    <SolutionAnchorNav />

    <section id="core-poc" className="scroll-mt-[172px] bg-[#f7f8f9] py-20 lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="01" title="核心 POC / 项目实践" description="两个独立 POC，分别验证知识服务与多步骤 Agent 在真实业务场景里的可用性。" />
      <div className="mt-12 grid gap-5 lg:grid-cols-2">{featuredCases.map(({ title, label, icon: Icon, scenario, problem, solution, work, href, action }) => <article key={title} className="rounded-[28px] border border-black/5 bg-white p-7 sm:p-8"><div className="flex items-center justify-between gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c7ff4d]"><Icon size={18} /></span><span className="rounded-full border border-black/10 px-3 py-1.5 text-[11px] text-neutral-500">{label}</span></div><h3 className="mt-12 text-3xl font-medium tracking-[-0.04em]">{title}</h3><div className="mt-7 space-y-4 border-y border-black/5 py-5 text-sm leading-6"><p><span className="mr-3 text-xs font-semibold tracking-[0.12em] text-neutral-400">业务场景</span>{scenario}</p><p><span className="mr-3 text-xs font-semibold tracking-[0.12em] text-neutral-400">核心问题</span>{problem}</p><p><span className="mr-3 text-xs font-semibold tracking-[0.12em] text-neutral-400">方案一句话</span>{solution}</p><p><span className="mr-3 text-xs font-semibold tracking-[0.12em] text-neutral-400">我的工作</span>{work}</p></div><Link href={href} className="mt-7 inline-flex items-center gap-2 text-sm font-medium transition hover:text-neutral-500">{action} <ArrowUpRight size={15} /></Link></article>)}</div>
    </div></section>

    <section id="solution-design" className="scroll-mt-[172px] bg-[#f7f8f9] py-20 lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="02" title="售前方案方法论" description="展示从业务需求到技术方案之间的决策过程，而不只是罗列最终技术栈。" />
      <div className="mt-12 rounded-[28px] border border-black/5 bg-[#f7f8f9] p-6 sm:p-8"><p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">售前方案方法论</p><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{methodSteps.map(([title, description], index) => <article key={title} className="rounded-2xl bg-white p-5"><p className="text-xs font-semibold text-neutral-400">{String(index + 1).padStart(2, "0")}</p><h3 className="mt-6 font-medium">{title}</h3><p className="mt-2 text-xs leading-6 text-neutral-500">{description}</p></article>)}</div></div>
      <div className="mt-16 rounded-[28px] bg-black p-7 text-white sm:p-8"><p className="text-[11px] font-semibold tracking-[0.18em] text-white/45">技术选型决策树</p><h3 className="mt-5 text-3xl font-medium tracking-[-0.04em]">从问题特征开始，而不是先选模型</h3><div className="mt-8 space-y-3 text-sm"><div className="rounded-2xl bg-white/10 p-4">客户问题是否依赖私有知识？</div><div className="ml-5 border-l border-white/20 pl-4"><p className="text-white/55">否 → 通用 LLM / Web Search</p><p className="mt-3 rounded-xl bg-white/10 p-3">是 → 知识是否频繁变化？</p><div className="ml-4 mt-3 border-l border-white/20 pl-4"><p className="text-[#c7ff4d]">是 → RAG</p><p className="mt-3 text-white/55">否 → 是否需要改变固定行为模式？</p><p className="mt-2 text-[#c7ff4d]">是 → Fine-tuning</p></div></div><div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-3"><p>多步骤任务 → Agent</p><p>扫描文件 → OCR</p><p>实时外部数据 → Web Search</p></div></div>
      </div>
    </div></section>

    <section id="business-thinking" className="scroll-mt-[172px] py-20 lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="03" title="从业务问题到 POC" description="展示我如何从客户问题拆解到可验证方案。" />
      <div className="mt-12 overflow-hidden rounded-[28px] border border-black/5 bg-white"><div className="overflow-x-auto"><table className="min-w-[780px] w-full text-left"><thead className="bg-[#f7f8f9] text-xs font-medium text-neutral-500"><tr><th className="w-[14%] px-6 py-4">业务场景</th><th className="w-[30%] px-6 py-4">客户问题</th><th className="w-[28%] px-6 py-4">我的判断</th><th className="w-[28%] px-6 py-4">POC 验证重点</th></tr></thead><tbody className="divide-y divide-black/5">{problemToPoc.map(({ title, problems, judgment, focus }) => <tr key={title} className="align-top transition-colors hover:bg-[#f7ffe8]"><th className="px-6 py-6"><span className="inline-flex rounded-full bg-[#c7ff4d] px-3 py-1.5 text-sm font-medium text-neutral-950">{title}</span></th><td className="px-6 py-6"><ul className="space-y-2 text-sm leading-6 text-neutral-600">{problems.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c7ff4d]" />{item}</li>)}</ul></td><td className="px-6 py-6 text-sm leading-7 text-neutral-700">{judgment}</td><td className="px-6 py-6"><div className="flex flex-wrap gap-2">{focus.map((item) => <span key={item} className="rounded-full bg-[#f7f8f9] px-3 py-1.5 text-xs text-neutral-600">{item}</span>)}</div></td></tr>)}</tbody></table></div></div>
    </div></section>

    <section id="solution-architecture" className="scroll-mt-[172px] py-20 lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="04" title="技术选型与方案架构" description="选什么，更要说清为什么这样选；数据流和证据链共同保证方案可以解释、复核和迭代。" />
      <div className="mt-12 grid gap-5">{comparisons.map((comparison) => <ComparisonTable key={comparison.title} {...comparison} />)}</div>
      <div className="mt-20 grid gap-5 lg:grid-cols-2">{architectures.map(({ title, icon: Icon, nodes, highlights }) => <article key={title} className="rounded-[28px] border border-black/5 bg-[#f7f8f9] p-7"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white"><Icon size={18} /></span><h3 className="mt-8 text-2xl font-medium tracking-[-0.035em]">{title}</h3><InlineFlow nodes={nodes} highlights={highlights} /></article>)}</div>
    </div></section>

    <section id="value-validation" className="scroll-mt-[172px] bg-[#f7f8f9] py-20 lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="05" title="竞品与替代方案分析" description="把替代路径说清楚，才能说明方案价值。" />
      <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-500">以下比较用于解释不同解法的适用范围，不将人工客服、FAQ 或通用模型简单称为“竞品”。</p>
      <div className="mt-8 grid gap-5">{alternatives.map((alternative) => <ComparisonTable key={alternative.title} {...alternative} />)}</div>
    </div></section>

    <section id="roi" className="scroll-mt-[172px] bg-black py-20 text-white lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="06" title="方案价值量化 / ROI" description="先说明价值如何产生，再讨论具体 ROI。" dark />
      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60">业务价值推演，不代表真实商业部署结果。</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-2"><article className="rounded-[24px] border border-white/10 bg-white/5 p-6"><p className="font-medium">AI 导购</p><p className="mt-3 text-sm leading-7 text-white/55">现状：人工查找产品资料并手工回答。方案：知识库检索 + AI 导购。</p><div className="mt-5 flex flex-wrap gap-2">{["减少重复查询", "缩短资料查找路径", "统一回答口径", "支持首轮问答", "降低新人培训成本"].map((item) => <span key={item} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75">{item}</span>)}</div></article><article className="rounded-[24px] border border-white/10 bg-white/5 p-6"><p className="font-medium">招投标 Agent</p><p className="mt-3 text-sm leading-7 text-white/55">现状：人工逐页浏览招标文件。方案：Agent 首轮筛查 + 人工复核。</p><div className="mt-5 flex flex-wrap gap-2">{["更快定位资格条件", "提取评分标准", "发现资料缺失", "降低遗漏风险", "减少重复整理"].map((item) => <span key={item} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75">{item}</span>)}</div></article></div>
      <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-6"><p className="text-sm font-medium">ROI / 效率评估框架</p><InlineFlow nodes={["人工时间 × 人员数量 × 任务频次", "减少的人工处理时间", "降低的遗漏风险", "知识复用价值"]} highlights={["知识复用价值"]} /><p className="mt-5 text-xs leading-6 text-white/55">实际 ROI 需结合客户实际业务量、人员成本和调用成本测算；当前页面不展示未经验证的效率或成本百分比。</p></div>
    </div></section>

    <section id="poc" className="scroll-mt-[172px] bg-black py-20 text-white lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="07" title="POC 验证与价值交付" description="展示这些能力如何构成一个可以验证的 POC，以及结果该怎样被正确解读。" dark />
      <div className="mt-12 grid gap-5 lg:grid-cols-2"><article className="rounded-[28px] border border-white/10 bg-white/5 p-7"><FlaskConical className="text-[#c7ff4d]" size={20} /><h3 className="mt-10 text-2xl font-medium">AI 导购 POC 链路</h3><InlineFlow nodes={["用户需求", "规则 / 检索", "商品匹配", "带来源回答", "边界提示"]} highlights={["带来源回答"]} /><p className="mt-6 text-sm leading-7 text-white/60">以项目资料、价格 Evidence、推荐规则和可选实时 RAG 组织回答；资料不足时明确回退。</p></article><article className="rounded-[28px] border border-white/10 bg-white/5 p-7"><SearchCheck className="text-[#c7ff4d]" size={20} /><h3 className="mt-10 text-2xl font-medium">招投标 Agent POC 链路</h3><InlineFlow nodes={["文件输入", "解析 / OCR", "检索 / 工具", "分析", "Evidence / Trace", "人工复核"]} highlights={["Evidence / Trace"]} /><p className="mt-6 text-sm leading-7 text-white/60">将解析、Hybrid RAG、企业资料、Web Search 与工具调用路径组织为可复核的首轮分析。</p></article></div>
      <div className="mt-16 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"><article className="rounded-[28px] border border-[#c7ff4d]/40 bg-[#c7ff4d] p-7 text-black"><p className="text-[11px] font-semibold tracking-[0.16em] text-black/55">实测结果</p><p className="mt-10 text-4xl font-medium tracking-[-0.05em]">57 / 57 PASS</p><p className="mt-3 text-sm leading-6 text-black/70">招投标 Agent evidence regression，覆盖解析、Evidence、工具路径、降级与项目隔离等回归用例。</p><div className="mt-7 inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white"><CheckCircle2 size={14} /> npm run test:tender</div></article><article className="rounded-[28px] border border-white/10 bg-white/5 p-7"><p className="text-[11px] font-semibold tracking-[0.16em] text-white/45">验证边界</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><div><p className="text-sm font-medium">已验证</p><div className="mt-3 flex flex-wrap gap-2">{["生产构建", "招投标回归测试", "Evidence / Trace", "OCR / Web 降级"].map((item) => <span key={item} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/75">{item}</span>)}</div></div><div><p className="text-sm font-medium">待进一步验证</p><div className="mt-3 flex flex-wrap gap-2">{["大规模并发", "真实生产数据", "长期知识维护成本", "客户现场验收"].map((item) => <span key={item} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/55">{item}</span>)}</div></div></div><p className="mt-6 text-xs leading-6 text-white/55">未将个人作品集 POC 描述为正式生产部署；上述范围外需要结合真实业务环境继续验证。</p></article></div>
    </div></section>

    <section id="project-review" className="scroll-mt-[172px] bg-[#f7f8f9] py-20 lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="08" title="关键决策与项目复盘" description="不只展示最终结果，也展示方案中真实做过的判断、失败边界与迭代方向。" />
      <div className="mt-12 grid gap-4 md:grid-cols-2">{decisions.map(([title, content]) => <article key={title} className="rounded-[24px] border border-black/5 bg-white p-6"><CircleAlert size={18} /><h3 className="mt-8 text-xl font-medium">{title}</h3><p className="mt-3 text-sm leading-7 text-neutral-600">{content}</p></article>)}</div>
    </div></section>

    <section id="retrospectives" className="scroll-mt-[172px] bg-[#f7f8f9] pb-20 lg:scroll-mt-[124px] lg:pb-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="09" title="失败案例与复盘" description="把问题、根因、方案与收获讲清楚。" />
      <div className="mt-12 space-y-3">{retrospectives.map(({ title, root, solution, result, learning }, index) => <article key={title} className="rounded-[24px] border border-black/5 bg-white p-6"><div><span className="inline-flex rounded-full bg-[#c7ff4d] px-3 py-1.5 text-xs font-medium text-neutral-950">CASE {String(index + 1).padStart(2, "0")}</span><h3 className="mt-4 text-xl font-medium tracking-[-0.025em] text-neutral-900 sm:text-2xl">{title}</h3></div><div className="mt-6 grid gap-3 border-t border-black/5 pt-6 sm:grid-cols-2 lg:grid-cols-4"><p className="text-sm leading-6 text-neutral-600"><span className="block text-xs font-semibold tracking-[0.14em] text-neutral-400">根因</span><span className="mt-2 block">{root}</span></p><p className="text-sm leading-6 text-neutral-600"><span className="block text-xs font-semibold tracking-[0.14em] text-neutral-400">解决方案</span><span className="mt-2 block">{solution}</span></p><p className="text-sm leading-6 text-neutral-600"><span className="block text-xs font-semibold tracking-[0.14em] text-neutral-400">最终结果</span><span className="mt-2 block">{result}</span></p><p className="text-sm leading-6 text-neutral-600"><span className="block text-xs font-semibold tracking-[0.14em] text-neutral-400">我的判断 / 收获</span><span className="mt-2 block">{learning}</span></p></div></article>)}</div>
    </div></section>

    <section id="deliverables" className="scroll-mt-[172px] py-20 lg:scroll-mt-[124px] lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
      <SectionHeading index="10" title="业务资料与交付材料" description="真实业务资料整理、产品理解与方案表达材料。" />
      <div className="mt-12 grid gap-5 lg:grid-cols-2"><article className="rounded-[28px] border border-black/5 bg-white p-7 sm:p-8"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c7ff4d]"><FileText size={18} /></span><p className="mt-10 text-[11px] font-semibold tracking-[0.16em] text-neutral-400">业务材料</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.035em]">一叶春山｜产品手册</h3><p className="mt-4 text-sm leading-7 text-neutral-600">茶品牌产品资料与业务方案展示。</p><p className="mt-3 text-xs leading-6 text-neutral-400">同时作为一叶春山 AI 导购知识库资料之一。</p><Link href={siteConfig.materials.teaManual.href} className="mt-8 inline-flex items-center gap-2 text-sm font-medium transition hover:text-neutral-500">查看产品手册 <ArrowRight size={15} /></Link></article><article className="rounded-[28px] border border-black/5 bg-white p-7 sm:p-8"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c7ff4d]"><FileText size={18} /></span><p className="mt-10 text-[11px] font-semibold tracking-[0.16em] text-neutral-400">业务材料</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.035em]">华文通｜产品手册</h3><p className="mt-4 text-sm leading-7 text-neutral-600">产品与解决方案材料展示。</p><Link href={siteConfig.materials.huawentongManual.href} className="mt-8 inline-flex items-center gap-2 text-sm font-medium transition hover:text-neutral-500">查看产品手册 <ArrowRight size={15} /></Link></article></div>
    </div></section>
    <SolutionDeliveryCenter />
    <Footer />
  </main>;
}
