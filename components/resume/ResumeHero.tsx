import Link from "next/link";
import { ArrowDownRight, ArrowRight, MapPin, GraduationCap } from "lucide-react";

const focusTags = ["需求分析", "RAG", "Agent", "Function Calling", "POC 验证", "Vibe Coding"];

export function ResumeHero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-5 lg:px-8">
      <div className="sky-panel min-h-[520px] rounded-[30px] px-6 py-7 text-white shadow-soft sm:px-10 lg:px-14 lg:py-10">
        <div className="relative z-10 flex min-h-[455px] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.14em] text-white/85">
            <span>ONLINE RESUME</span>
            <span>AI PRESALES · 2027</span>
          </div>

          <div className="mt-16 grid gap-10 lg:mt-20 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-white/80">黄念红 · AI 售前 / 解决方案工程师</p>
              <h1 className="mt-4 max-w-4xl text-5xl font-medium leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                把业务问题，
                <br />
                变成能验证的 AI 方案
              </h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
                数字媒体技术背景，正在围绕 AI 售前方向持续搭建可交互 Demo。
                关注需求澄清、方案设计、RAG / Agent 落地、POC 测试与面试现场表达。
              </p>
            </div>

            <div className="glass-card rounded-[26px] p-5 text-black shadow-sm sm:p-6">
              <div className="flex items-center gap-3 border-b border-black/5 pb-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">HN</span>
                <div>
                  <p className="font-medium">黄念红</p>
                  <p className="mt-1 text-xs text-neutral-500">2027 届 · 数字媒体技术</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-neutral-600">
                <p className="flex items-center gap-2"><GraduationCap size={15} /> 南京邮电大学通达学院</p>
                <p className="flex items-center gap-2"><MapPin size={15} /> 求职方向：AI 售前 / 解决方案工程师</p>
              </div>
              <Link
                href="#projects"
                className="mt-5 inline-flex w-full items-center justify-between rounded-full bg-[#c7ff4d] px-4 py-3 text-sm font-semibold text-black"
              >
                查看项目经历 <ArrowDownRight size={16} />
              </Link>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-12">
            {focusTags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/25 bg-black/10 px-3 py-1.5 text-xs text-white/90 backdrop-blur">
                {tag}
              </span>
            ))}
            <Link href="/" className="ml-auto hidden items-center gap-2 text-xs font-medium text-white/85 transition hover:text-white sm:inline-flex">
              返回首页 <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
