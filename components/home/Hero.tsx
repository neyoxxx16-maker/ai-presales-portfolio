import Link from "next/link";
import { ArrowRight, Database, FileCheck2, Search, Workflow, Wrench } from "lucide-react";

const tags = [
  { label: "RAG", icon: Search },
  { label: "Agent", icon: Workflow },
  { label: "Function Calling", icon: Wrench },
  { label: "POC验证", icon: FileCheck2 },
  { label: "需求分析", icon: Database },
];

export function Hero() {
  return (
    <section className="mx-auto max-w-[1520px] px-2 pt-5 sm:px-3 lg:px-4">
      <div className="sky-panel min-h-[720px] rounded-[30px] px-6 py-7 text-white shadow-soft sm:px-10 lg:min-h-[calc(100svh-106px)] lg:px-14 lg:py-10">
        <div className="relative z-10 flex min-h-[660px] flex-col lg:min-h-[calc(100svh-166px)]">
          <div className="flex items-center justify-between text-xs font-medium tracking-[0.14em] text-white/85">
            <span>AI PRESALES PORTFOLIO</span>
            <span>2027届 · 数字媒体技术</span>
          </div>

          <div className="mx-auto mt-24 max-w-4xl text-center lg:mt-28">
            <p className="mb-5 text-sm font-medium text-white/80">AI售前 / 解决方案工程师</p>
            <h1 data-hero-reveal className="text-balance text-5xl font-medium leading-[1.13] tracking-[-0.018em] sm:text-6xl lg:text-7xl">
              把 AI 能力变成真正
              <br />
              可落地的解决方案
            </h1>
            <p data-hero-reveal className="mx-auto mt-7 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
              从需求澄清、架构设计到可交互 Demo 与 POC 验证，
              用可见的产品体验解释 RAG、Agent 与 Function Calling 的业务价值。
            </p>

            <div data-hero-reveal className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/demo/tea-assistant" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
                体验 AI 导购 <ArrowRight className="button-arrow" size={16} />
              </Link>
              <Link href="/resume" className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/15 px-5 py-3 text-sm font-medium text-white backdrop-blur">
                查看在线简历
              </Link>
              <Link href="/solutions" className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/15 px-5 py-3 text-sm font-medium text-white backdrop-blur">
                查看方案成果 <ArrowRight className="button-arrow" size={16} />
              </Link>
            </div>
          </div>

          <div data-reveal-group className="mt-auto grid gap-3 pt-20 sm:grid-cols-2 lg:grid-cols-5">
            {tags.map(({ label, icon: Icon }) => (
              <div data-reveal-item key={label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-4 text-black">
                <span className="text-sm font-medium">{label}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c7ff4d]">
                  <Icon size={15} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
