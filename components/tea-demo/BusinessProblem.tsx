import { Files, MessagesSquare, Scale } from "lucide-react";

const problems = [
  ["01", "产品资料分散", "茶叶的价格、规格、口感、冲泡方式和适用场景分散，客服需要反复查找。", Files],
  ["02", "重复咨询较多", "送礼怎么选、预算内有什么推荐、红茶还是绿茶、怎么冲泡等问题反复出现。", MessagesSquare],
  ["03", "回答口径不统一", "不同客服人员可能给出不同答案，容易造成产品信息和推荐口径不一致。", Scale],
] as const;

export function BusinessProblem() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
      <div className="max-w-3xl">
        <p className="section-kicker">业务背景与痛点</p>
        <h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">当产品知识散落在资料里，服务体验就很难稳定。</h2>
      </div>
      <div className="mt-12 grid overflow-hidden rounded-[28px] border border-black/5 bg-[#f7f8f9] lg:grid-cols-3">
        {problems.map(([no, title, desc, Icon], index) => (
          <article key={title} className={`min-h-[300px] p-7 sm:p-8 ${index < 2 ? "border-b border-black/5 lg:border-b-0 lg:border-r" : ""}`}>
            <div className="flex items-center justify-between"><span className="text-xs font-semibold tracking-[0.18em] text-neutral-400">{no}</span><Icon size={18} /></div>
            <h3 className="mt-20 text-2xl font-medium tracking-[-0.035em]">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-neutral-500">{desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
