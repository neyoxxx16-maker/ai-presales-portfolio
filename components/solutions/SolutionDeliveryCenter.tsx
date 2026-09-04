"use client";

import { ArrowUpRight, Download, Github, Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/site-config";

export function SolutionDeliveryCenter() {
  const [contactOpen, setContactOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contactOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!contactRef.current?.contains(event.target as Node)) setContactOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContactOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [contactOpen]);

  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="rounded-[30px] bg-black p-7 text-white sm:p-10">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white/45">Delivery Center</p>
          <h2 className="mt-5 max-w-4xl text-3xl font-medium leading-[1.1] tracking-[-0.04em] sm:text-4xl">工具和模型不是终点，最终要把能力变成客户能够理解、验证和接受的方案。</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <div ref={contactRef} className="relative">
              <button type="button" onClick={() => setContactOpen((open) => !open)} aria-expanded={contactOpen} aria-haspopup="menu" className="rounded-full bg-[#c7ff4d] px-4 py-2.5 text-sm font-medium text-black transition hover:translate-y-[-1px]">联系我 <ArrowUpRight className="ml-1 inline" size={14} /></button>
              {contactOpen && <div role="menu" aria-label="联系入口" className="absolute bottom-full left-0 z-10 mb-3 w-56 rounded-2xl border border-black/10 bg-white p-2 text-sm text-neutral-800 shadow-soft">
                <a role="menuitem" href={siteConfig.links.github} target="_blank" rel="noopener noreferrer" onClick={() => setContactOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-[#f7f8f9]"><span className="flex items-center gap-2"><Github size={15} />GitHub</span><ArrowUpRight size={14} /></a>
                <a role="menuitem" href={siteConfig.links.email} onClick={() => setContactOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-[#f7f8f9]"><span className="flex items-center gap-2"><Mail size={15} />发送邮件</span><ArrowUpRight size={14} /></a>
                <a role="menuitem" href={siteConfig.links.resumePdf} download onClick={() => setContactOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-[#f7f8f9]"><span className="flex items-center gap-2"><Download size={15} />下载 PDF 简历</span><Download size={14} /></a>
              </div>}
            </div>
            <Link href="/demo/tender-agent" className="rounded-full border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10">查看项目二：招投标 Agent <ArrowUpRight className="ml-1 inline" size={14} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
