import { ArrowDown, BookOpenCheck, ClipboardList, Sparkles } from "lucide-react";

const steps = [
  ["01", "需求识别", "提取预算、对象、场景、偏好和茶类。", ClipboardList],
  ["02", "混合知识检索", "结构化事实优先；配置后再以向量检索补充相关知识。", BookOpenCheck],
  ["03", "可追溯回答", "模型只组织已检索资料，并展示本轮实际命中的资料来源。", Sparkles],
] as const;

export function SolutionOverview() {
  return (
    <section className="bg-[#f7f8f9] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="section-kicker">解决方案</p>
            <h2 className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-5xl">先理解需求，再给出有来源的商品建议。</h2>
            <p className="mt-5 text-sm leading-7 text-neutral-500">当前为 POC：价格、SKU 与推荐边界仍由规则引擎确定；实时 RAG 仅用于有来源的知识解释，并可安全回退。</p>
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
