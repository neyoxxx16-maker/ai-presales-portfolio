"use client";

import { Database, SearchCheck } from "lucide-react";

const tags = ["RAG", "Knowledge Base", "POC", "需求识别"];

export function TeaHero() {
  function startDemo() {
    const input = document.getElementById("tea-assistant-input") as HTMLInputElement | null;
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => input?.focus(), 450);
  }

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
              <p className="text-sm font-medium text-white/80">项目一：AI 导购 · 可在线体验</p>
              <h1 data-hero-reveal className="mt-3 text-5xl font-medium leading-[1.06] tracking-[-0.01em] sm:text-6xl lg:text-7xl">
                AI 知识库导购
              </h1>
              <p data-hero-reveal className="mt-7 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
                告诉我预算、送礼对象或口味偏好，我会从真实商品资料中帮你筛选。
              </p>
              <div data-hero-reveal className="mt-8">
                <button type="button" onClick={startDemo} className="rounded-full bg-[#c7ff4d] px-5 py-3 text-sm font-semibold text-black transition hover:bg-white">直接体验项目一：AI 导购</button>
              </div>
              <div data-hero-reveal className="mt-6 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="sky-chip px-3 py-1.5 text-xs">{tag}</span>)}</div>
            </div>
            <div className="glass-card relative self-end rounded-[26px] p-6 text-black sm:p-7 lg:-top-12 lg:left-3 lg:translate-y-16 lg:self-start">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c7ff4d]"><SearchCheck size={19} /></span>
              <h2 className="mt-12 text-2xl font-medium tracking-[-0.04em]">从需求出发，看系统怎么<br />一步步给出推荐。</h2>
              <p className="mt-4 text-sm leading-7 text-neutral-600">下方对话区可按预算、对象、茶类与包装继续筛选。</p>
              <div className="mt-6 flex items-center gap-2 text-xs text-neutral-500"><Database size={14} /> 基于当前已收录的真实商品资料</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
