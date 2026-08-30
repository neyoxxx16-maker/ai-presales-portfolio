import { ArrowDown, BookOpenCheck, ClipboardList, Sparkles } from "lucide-react";

const steps = [
  ["01", "需求识别", "提取预算、对象、场景、偏好和茶类。", ClipboardList],
  ["02", "Mock RAG 检索", "在本地商品与知识资料中进行关键词、场景和预算匹配。", BookOpenCheck],
  ["03", "可追溯回答", "输出推荐理由，并展示本轮实际命中的资料来源。", Sparkles],
] as const;

export function SolutionOverview() {
  return (
    <section className="bg-[#f7f8f9] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="section-kicker">解决方案</p>
            <h2 className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-5xl">先理解需求，再给出有来源的商品建议。</h2>
            <p className="mt-5 text-sm leading-7 text-neutral-500">当前为 POC：不调用真实大模型和向量数据库，但已将需求识别、检索与回答呈现拆为可替换的独立层。</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
            {steps.map(([no, title, desc, Icon], index) => (
              <div key={title} className="contents">
                <article className="rounded-[24px] border border-black/5 bg-white p-6"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c7ff4d]"><Icon size={17} /></span><p className="mt-10 text-xs font-semibold tracking-[0.16em] text-neutral-400">{no}</p><h3 className="mt-3 text-xl font-medium tracking-[-0.03em]">{title}</h3><p className="mt-3 text-sm leading-7 text-neutral-500">{desc}</p></article>
                {index < steps.length - 1 && <div className="hidden items-center justify-center text-neutral-400 sm:flex"><ArrowDown className="rotate-[-90deg]" size={18} /></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
