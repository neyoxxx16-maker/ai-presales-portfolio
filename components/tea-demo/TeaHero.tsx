import { Database, SearchCheck } from "lucide-react";

const tags = ["RAG", "Knowledge Base", "POC", "需求识别"];

export function TeaHero() {
  return (
    <section className="mx-auto max-w-[1520px] px-2 pt-5 sm:px-3 lg:px-4">
      <div className="sky-panel min-h-[650px] rounded-[30px] px-6 py-7 text-white shadow-soft sm:px-10 lg:min-h-[calc(100svh-130px)] lg:px-14 lg:py-10">
        <div className="relative z-10 min-h-[585px] lg:min-h-[calc(100svh-190px)]">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.14em] text-white/85">
            <span>PROJECT 01 · AI 茶饮知识服务</span>
            <span>当前版本 · 项目资料 POC</span>
          </div>
          <div className="mt-16 grid translate-y-20 gap-10 lg:mt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
            <div>
              <p className="text-sm font-medium text-white/80">一叶春山</p>
              <h1 data-hero-reveal className="mt-3 text-5xl font-medium leading-[1.06] tracking-[-0.01em] sm:text-6xl lg:text-7xl">
                AI 导购 /<br />客服知识库
              </h1>
              <p data-hero-reveal className="mt-7 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
                把分散的商品资料变成可检索、可追溯的 AI 销售顾问，用于选茶推荐、产品问答与基础客服场景。
              </p>
              <div data-hero-reveal className="mt-8 flex flex-wrap gap-2">
                {tags.map((tag) => <span key={tag} className="sky-chip px-3 py-1.5 text-xs">{tag}</span>)}
              </div>
            </div>
            <div className="glass-card relative self-end rounded-[26px] p-6 text-black sm:p-7 lg:-top-12 lg:left-3 lg:translate-y-16 lg:self-start">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c7ff4d]"><SearchCheck size={19} /></span>
              <h2 className="mt-12 text-2xl font-medium tracking-[-0.04em]">不是普通聊天框，<br />而是可解释的知识服务 POC。</h2>
              <p className="mt-4 text-sm leading-7 text-neutral-600">本页用项目资料整理的知识库与本地规则检索，演示可追溯问答与结构化推荐体验。</p>
              <div className="mt-6 flex items-center gap-2 text-xs text-neutral-500"><Database size={14} /> 部分商品资料仅用于 POC 演示</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
