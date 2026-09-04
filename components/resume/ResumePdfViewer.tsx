"use client";

import { useState, type WheelEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

const previewSrc = "/documents/resume-preview/huang-nihong-resume-2026-09-02.png";

export function ResumePdfViewer() {
  const [scale, setScale] = useState<number | "fit">("fit");
  const zoomOut = () => setScale((value) => Math.max(60, (value === "fit" ? 100 : value) - 10));
  const zoomIn = () => setScale((value) => Math.min(160, (value === "fit" ? 100 : value) + 10));
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else zoomOut();
  };

  return (
    <section id="resume-pdf" className="mx-auto max-w-[1100px] px-5 py-10 lg:px-8 lg:py-14">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/resume" className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-[#f7f8f9] hover:text-black">
          ← 返回在线简历
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={zoomOut} className="rounded-full border border-black/10 bg-white px-3 py-1.5 transition hover:bg-[#f7f8f9]" aria-label="缩小">−</button>
          <span className="min-w-12 text-center text-xs text-neutral-500">{scale === "fit" ? "适合页" : `${scale}%`}</span>
          <button type="button" onClick={zoomIn} className="rounded-full border border-black/10 bg-white px-3 py-1.5 transition hover:bg-[#f7f8f9]" aria-label="放大">＋</button>
          <button type="button" onClick={() => setScale("fit")} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs transition hover:bg-[#f7f8f9]">适合页面</button>
          <a href={siteConfig.links.resumePdf} download className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-neutral-800">下载 PDF 简历</a>
        </div>
      </div>
      <div onWheel={handleWheel} className="overflow-auto rounded-[20px] bg-[#f7f8f9] p-4 sm:p-6">
        <Image src={previewSrc} alt="黄念红 PDF 简历" width={1488} height={2105} unoptimized className="mx-auto block h-auto bg-white shadow-soft" style={scale === "fit" ? { maxHeight: "calc(100svh - 190px)", maxWidth: "100%", width: "auto" } : { width: `${scale}%`, maxWidth: "none" }} />
      </div>
    </section>
  );
}
