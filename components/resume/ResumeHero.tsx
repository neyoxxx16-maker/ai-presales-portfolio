import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Download, GraduationCap, MapPin } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

const focusTags = ["需求分析", "RAG", "Agent", "Function Calling", "POC 验证", "Vibe Coding"];

export function ResumeHero() {
  return (
    <section className="mx-auto max-w-[1520px] px-2 pt-5 sm:px-3 lg:px-4">
      <div className="sky-panel min-h-[620px] rounded-[30px] px-6 py-7 text-white shadow-soft sm:px-10 lg:min-h-[calc(100svh-130px)] lg:px-14 lg:py-10">
        <div className="relative z-10 flex min-h-[555px] flex-col lg:min-h-[calc(100svh-190px)]">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.14em] text-white/85">
            <span>ONLINE RESUME</span>
            <span>AI PRESALES · 2027</span>
          </div>

          <div className="mt-20 grid gap-10 lg:mt-24 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <p className="text-sm font-medium text-white/80">黄念红 · AI 售前 / 解决方案工程师</p>
              <h1 data-hero-reveal className="mt-4 max-w-4xl text-5xl font-medium leading-[1.06] tracking-[-0.01em] sm:text-6xl lg:text-7xl">
                把业务问题整理成
                <br />
                可验证的 AI 方案
              </h1>
              <p data-hero-reveal className="mt-7 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
                数字媒体技术背景，正在围绕 AI 售前方向持续搭建可交互 Demo。
                关注需求澄清、方案设计、RAG / Agent 落地、POC 测试与面试现场表达。
              </p>
              <div data-hero-reveal className="mt-7 flex flex-wrap gap-2.5 text-sm">
                <a href={siteConfig.links.resumePdf} download className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2.5 font-medium text-white transition hover:bg-black/80">
                  下载 PDF 简历 <Download className="button-arrow" size={14} />
                </a>
                <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-2.5 font-medium text-white transition hover:bg-white/20">
                  GitHub <ArrowUpRight className="button-arrow" size={14} />
                </a>
                <a href={siteConfig.links.email} className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-4 py-2.5 font-medium text-white transition hover:bg-white/20">
                  发送邮件 <ArrowUpRight className="button-arrow" size={14} />
                </a>
              </div>
            </div>

            <div className="glass-card relative rounded-[26px] p-5 text-black shadow-sm sm:p-6 lg:left-3 lg:top-6">
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
              <span key={tag} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/95 backdrop-blur">
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
