const steps = [
  ["01", "需求澄清", "先明确业务目标、用户、数据范围和验收口径。"],
  ["02", "方案设计", "把 AI 能力映射到具体流程，而不是单纯堆模型名词。"],
  ["03", "Demo验证", "快速做出可交互原型，让抽象方案变得可体验。"],
  ["04", "POC测试", "通过成功与失败用例验证边界、效果和可落地性。"],
] as const;

export function WorkMethod() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <p className="section-kicker">我的工作方式</p>
        <h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">从业务问题出发，而不是从模型出发</h2>
        <p className="mt-5 text-base leading-8 text-neutral-500">售前 Demo 的价值，不是炫技，而是让客户看见“这项能力怎么解决我的问题”。</p>
      </div>

      <div className="mt-14 grid overflow-hidden rounded-[28px] border border-black/5 bg-[#f7f8f9] md:grid-cols-2 lg:grid-cols-4">
        {steps.map(([index, title, desc], i) => (
          <article key={title} className={`min-h-[250px] p-7 ${i !== steps.length - 1 ? "border-b border-black/5 lg:border-b-0 lg:border-r" : ""}`}>
            <div className="flex h-full flex-col">
              <span className="text-xs font-semibold tracking-[0.15em] text-neutral-400">{index}</span>
              <h3 className="mt-auto pt-16 text-2xl font-medium tracking-[-0.035em]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-neutral-500">{desc}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
