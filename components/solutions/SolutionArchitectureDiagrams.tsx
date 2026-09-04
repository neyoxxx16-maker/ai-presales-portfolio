import { ArrowDown, ArrowRight, Bot, FileSearch, SearchCheck, ShieldCheck } from "lucide-react";

function FlowArrow() {
  return <ArrowDown aria-hidden="true" className="mx-auto my-3 text-neutral-300" size={16} />;
}

function FlowChip({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return <span className={`inline-flex min-h-9 items-center rounded-xl px-3 py-2 text-xs font-medium leading-5 ${highlight ? "bg-[#c7ff4d] text-neutral-950" : "border border-black/5 bg-white text-neutral-600"}`}>{children}</span>;
}

function Layer({ label, children, tone = "light" }: { label: string; children: React.ReactNode; tone?: "light" | "dark" }) {
  return <div className={`rounded-2xl p-5 ${tone === "dark" ? "bg-black text-white" : "border border-black/5 bg-[#f7f8f9]"}`}><p className={`text-[11px] font-semibold tracking-[0.15em] ${tone === "dark" ? "text-white/45" : "text-neutral-400"}`}>{label}</p>{children}</div>;
}

export function SolutionArchitectureDiagrams() {
  return <div className="mt-20 space-y-5">
    <article className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 sm:p-8">
      <div className="max-w-3xl"><p className="section-kicker">System Architecture</p><h3 className="mt-4 text-3xl font-medium tracking-[-0.04em]">项目一：AI 导购 · 系统架构</h3><p className="mt-4 rounded-2xl bg-[#efffd0] px-4 py-3 text-sm font-medium leading-6 text-neutral-900">不是普通聊天框，而是基于真实产品知识库的可解释知识服务 POC。</p></div>
      <div className="mt-8 space-y-3">
        <Layer label="01 用户交互层"><div className="mt-3 flex flex-col gap-2 text-sm font-medium text-neutral-800 sm:flex-row sm:items-center"><FlowChip>用户提问 / 产品咨询 / 场景需求</FlowChip><ArrowRight className="hidden text-neutral-300 sm:block" size={15} /><FlowChip>对话式 Web Demo</FlowChip><ArrowRight className="hidden text-neutral-300 sm:block" size={15} /><FlowChip>商品推荐 + 产品问答 + 来源引用</FlowChip></div></Layer>
        <Layer label="02 AI 核心能力层"><div className="mt-3 flex flex-wrap items-center gap-2"><FlowChip>意图识别</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>Query 重写</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip highlight>RAG 检索</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>商品信息匹配</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>推荐边界判断</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>DeepSeek / LLM 生成</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>可解释回答</FlowChip></div></Layer>
        <Layer label="03 知识检索层"><div className="mt-3 grid gap-3 md:grid-cols-[0.9fr_auto_1.1fr] md:items-center"><div className="flex flex-wrap gap-2">{["产品手册", "SKU 信息", "产品卖点", "价格 / 规格 / 包装", "FAQ / 业务资料"].map((item) => <FlowChip key={item}>{item}</FlowChip>)}</div><ArrowRight className="mx-auto rotate-90 text-neutral-300 md:rotate-0" size={16} /><div className="flex flex-wrap gap-2"><FlowChip>文本切分</FlowChip><FlowChip>Embedding</FlowChip><FlowChip highlight>向量检索 + 关键词检索</FlowChip><FlowChip>相关知识片段召回</FlowChip></div></div></Layer>
        <Layer label="04 输出与保障层"><div className="mt-3 flex flex-wrap gap-2">{["答案来源引用", "无答案兜底", "资料冲突处理", "越权请求限制", "日志 / 检索结果可追溯"].map((item) => <FlowChip key={item}>{item}</FlowChip>)}</div></Layer>
      </div>
    </article>

    <article className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 sm:p-8">
      <div className="max-w-3xl"><p className="section-kicker">System Architecture</p><h3 className="mt-4 text-3xl font-medium tracking-[-0.04em]">项目二：招投标 Agent · 系统架构</h3><p className="mt-4 text-sm leading-7 text-neutral-500">文档解析、Hybrid RAG、Agent Tool Calling、Evidence 与外部检索共同构成可复核的判断系统。</p></div>
      <div className="mt-8 grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <Layer label="01 输入层"><div className="mt-3 flex flex-wrap gap-2"><FlowChip>招标文件 · PDF / Word / 扫描件</FlowChip><FlowChip>企业资料 · 资质 / 案例 / 产品能力</FlowChip><FlowChip>用户问题 · 能不能投 / 有哪些风险 / 还缺什么</FlowChip></div></Layer>
          <Layer label="02 文档处理层"><div className="mt-3 flex flex-wrap items-center gap-2"><FlowChip>文件解析</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip highlight>OCR · 扫描件 / 图片型 PDF</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>文本清洗</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>Chunking</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>结构化信息抽取 / 招标要求识别</FlowChip></div></Layer>
          <Layer label="03 知识与检索层"><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><p className="text-xs font-medium text-neutral-800">企业知识库</p><p className="mt-2 text-xs leading-5 text-neutral-500">资质、案例、产品能力、历史材料</p></div><div><p className="text-xs font-medium text-neutral-800">Hybrid RAG</p><p className="mt-2 text-xs leading-5 text-neutral-500">关键词检索 + 向量检索 + RRF 融合</p></div><div><p className="text-xs font-medium text-neutral-800">web_search / Tavily</p><p className="mt-2 text-xs leading-5 text-neutral-500">外部公开信息补充与核验</p></div></div></Layer>
          <Layer label="04 Agent 核心层" tone="dark"><div className="mt-4 rounded-2xl bg-white/10 p-5"><div className="flex items-center gap-3"><Bot className="text-[#c7ff4d]" size={20} /><p className="text-lg font-medium">Tender Analysis Agent</p></div><div className="mt-4 flex flex-wrap gap-2 text-white/80">{["任务拆解", "工具选择", "多步分析", "证据收集", "结果校验", "风险判断", "缺失项识别", "评分项分析"].map((item) => <span key={item} className="rounded-xl bg-white/10 px-3 py-2 text-xs">{item}</span>)}</div><p className="mt-4 text-xs leading-6 text-white/60">Agent 根据当前任务自主选择 knowledge_search、web_search、OCR、企业知识库与招标文件，而不是固定流程调用。</p></div></Layer>
          <Layer label="05 输出层"><div className="mt-3 flex flex-wrap gap-2">{["可投性结论", "风险项", "缺失资料", "资质匹配", "评分分析", "行动建议", "证据引用 / 页码"].map((item) => <FlowChip key={item}>{item}</FlowChip>)}</div></Layer>
        </div>
        <aside className="rounded-[24px] border border-black/5 bg-[#f7f8f9] p-5"><ShieldCheck className="text-neutral-900" size={19} /><p className="mt-6 text-[11px] font-semibold tracking-[0.15em] text-neutral-400">可追溯能力</p><div className="mt-4 space-y-3"><div><p className="text-sm font-medium">Agent Trace</p><p className="mt-1 text-xs leading-5 text-neutral-500">执行步骤记录</p></div><div><p className="text-sm font-medium">Evidence</p><p className="mt-1 text-xs leading-5 text-neutral-500">引用来源与页码</p></div><div><p className="text-sm font-medium">结果校验</p><p className="mt-1 text-xs leading-5 text-neutral-500">结论可回看、可复核</p></div></div></aside>
      </div>
    </article>

    <article className="overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 sm:p-8">
      <div className="max-w-3xl"><p className="section-kicker">Execution Flow</p><h3 className="mt-4 text-3xl font-medium tracking-[-0.04em]">招投标 Agent · 单次任务执行流程</h3><p className="mt-4 text-sm leading-7 text-neutral-500">系统结构说明“由什么组成”；这条流程说明 Agent 接到一次任务后如何一步步完成判断。</p></div>
      <div className="mt-8 max-w-4xl">
        <Layer label="STEP 01 上传资料"><div className="mt-3 flex flex-wrap gap-2"><FlowChip>招标文件</FlowChip><FlowChip>企业资料</FlowChip></div></Layer><FlowArrow />
        <Layer label="STEP 02 文档预处理"><div className="mt-3 flex flex-wrap items-center gap-2"><FlowChip>文件类型识别</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>文本解析</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>必要时 OCR</FlowChip><ArrowRight className="text-neutral-300" size={14} /><FlowChip>文本切分 / 结构化</FlowChip></div></Layer><FlowArrow />
        <Layer label="STEP 03–04 Agent 理解与任务拆解"><p className="mt-3 text-sm leading-6 text-neutral-600">识别“我们公司能不能参与这次投标？”等用户问题，并拆解为资质要求检查、企业能力与案例匹配、评分项、风险项及缺失资料识别。</p></Layer><FlowArrow />
        <Layer label="STEP 05 工具调用"><div className="mt-3 rounded-2xl bg-white p-4"><p className="text-sm font-medium text-neutral-900">当前信息是否足够？</p><div className="mt-3 grid gap-2 text-xs leading-5 text-neutral-600 sm:grid-cols-3"><p><span className="font-medium text-neutral-900">信息不足</span><br />knowledge_search → Hybrid RAG 检索企业资料</p><p><span className="font-medium text-neutral-900">仍然不足</span><br />web_search / Tavily → 外部公开信息核验</p><p><span className="font-medium text-neutral-900">PDF 无法解析</span><br />OCR → 提取扫描件文本</p></div></div></Layer><FlowArrow />
        <Layer label="STEP 06 Evidence 汇总"><div className="mt-3 flex flex-wrap gap-2"><FlowChip>招标文件原文</FlowChip><FlowChip>企业资料原文</FlowChip><FlowChip>外部信息来源</FlowChip><FlowChip>页码 / 引用</FlowChip></div></Layer><FlowArrow />
        <Layer label="STEP 07–09 综合判断、输出与 Trace" tone="dark"><div className="mt-3"><p className="text-sm leading-6 text-white/75">LLM + Rules + Evidence 输出可投 / 谨慎投 / 不建议投，以及风险原因、缺失资料、资质差距、评分机会和下一步行动。</p><div className="mt-4 flex flex-wrap gap-2">{["投标分析总览", "风险清单", "评分分析", "补充资料建议", "Agent Trace：工具、检索与结论依据"].map((item) => <span key={item} className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">{item}</span>)}</div></div></Layer>
      </div>
    </article>
  </div>;
}
