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
          <div className="flex flex-col gap-1.5 text-[10px] font-medium leading-relaxed tracking-[0.14em] text-white/85 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:text-xs">
            <span>AI PRESALES PORTFOLIO</span>
            <span>2027届 · 数字媒体技术</span>
          </div>

          <div className="mx-auto mt-20 max-w-[1280px] text-center sm:mt-32 lg:mt-36">
            <p className="mb-4 text-[13px] font-medium text-white/80 sm:mb-5 sm:text-sm">AI售前 / 解决方案工程师</p>
            <h1 data-hero-reveal className="mx-auto max-w-[20rem] text-[clamp(2.25rem,10.5vw,3rem)] font-medium leading-[1.12] tracking-[-0.04em] sm:max-w-none sm:whitespace-nowrap sm:text-6xl sm:leading-[1.06] sm:tracking-[-0.03em] lg:text-7xl">
              把AI做成客户看得懂、能验证的方案
            </h1>
            <p data-hero-reveal className="mx-auto mt-5 max-w-[20rem] text-[13px] leading-6 text-white/85 sm:mt-7 sm:max-w-2xl sm:text-base sm:leading-7">
              从需求澄清、架构设计到可交互 Demo 与 POC 验证，
              用可见的产品体验解释 RAG、Agent 与 Function Calling 的业务价值。
            </p>

            <div data-hero-reveal className="mt-7 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center">
              <Link href="/demo/tea-assistant" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
                体验项目一：AI 导购 <ArrowRight className="button-arrow" size={16} />
              </Link>
              <Link href="/resume" className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20">
                查看在线简历
              </Link>
              <Link href="/solutions" className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20">
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
