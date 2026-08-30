import { Database, SearchCheck } from "lucide-react";

const tags = ["RAG", "Knowledge Base", "POC", "需求识别"];

export function TeaHero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-5 lg:px-8">
      <div className="sky-panel rounded-[30px] px-6 py-7 text-white shadow-soft sm:px-10 lg:px-14 lg:py-10">
        <div className="relative z-10 grid min-h-[500px] gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.14em] text-white/85">
              <span>PROJECT 01 · AI 茶饮知识服务</span>
              <span>当前版本 · Mock RAG Demo</span>
            </div>
            <div className="mt-auto pt-20 lg:pt-28">
              <p className="text-sm font-medium text-white/80">一叶春山</p>
              <h1 className="mt-3 text-5xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                AI 导购 /<br />客服知识库
              </h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
                把分散的商品资料变成可检索、可追溯的 AI 销售顾问，用于选茶推荐、产品问答与基础客服场景。
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {tags.map((tag) => <span key={tag} className="rounded-full border border-white/30 bg-black/10 px-3 py-1.5 text-xs text-white/95">{tag}</span>)}
              </div>
            </div>
          </div>
          <div className="glass-card rounded-[26px] p-6 text-black sm:p-7">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c7ff4d]"><SearchCheck size={19} /></span>
            <h2 className="mt-12 text-2xl font-medium tracking-[-0.04em]">不是普通聊天框，<br />而是可解释的知识服务 POC。</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600">本页用本地商品资料、规则意图识别和 Mock 检索，演示可追溯问答与结构化推荐体验。</p>
            <div className="mt-6 flex items-center gap-2 text-xs text-neutral-500"><Database size={14} /> 部分商品资料仅用于 POC 演示</div>
          </div>
        </div>
      </div>
    </section>
  );
}
