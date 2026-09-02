"use client";

import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type ManualViewerProps = {
  pages: readonly string[];
  title?: string;
  pageSize?: { width: number; height: number };
};

export function TeaManualViewer({ pages, title = "一叶春山产品手册", pageSize = { width: 1684, height: 1190 } }: ManualViewerProps) {
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState(100);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToPage = useCallback((nextPage: number) => {
    const container = scrollContainerRef.current;
    const target = pageRefs.current[nextPage];
    if (!container || !target) return;

    const containerBounds = container.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + targetBounds.top - containerBounds.top - 16,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visiblePages = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const foremostPage = visiblePages[0];
        if (!foremostPage) return;

        const nextPage = Number((foremostPage.target as HTMLElement).dataset.pageIndex);
        if (!Number.isNaN(nextPage)) setPage(nextPage);
      },
      { root: container, rootMargin: "-12% 0px -38%", threshold: [0.2, 0.45, 0.7] },
    );

    pageRefs.current.forEach((pageElement) => {
      if (pageElement) observer.observe(pageElement);
    });

    return () => observer.disconnect();
  }, [pages.length, scale]);

  return (
    <section aria-label={`${title}阅读器`} className="mt-10 overflow-hidden rounded-[28px] border border-black/5 bg-[#f7f8f9]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 bg-white px-5 py-3 sm:px-6">
        <p className="text-xs font-medium text-neutral-500">第 {page + 1} / {pages.length} 页</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setScale((value) => Math.max(80, value - 10))} disabled={scale === 80} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/5 disabled:opacity-35" aria-label="缩小页面"><ZoomOut size={15} /></button>
          <span className="w-10 text-center text-xs tabular-nums text-neutral-500">{scale}%</span>
          <button type="button" onClick={() => setScale((value) => Math.min(120, value + 10))} disabled={scale === 120} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/5 disabled:opacity-35" aria-label="放大页面"><ZoomIn size={15} /></button>
          <span className="mx-1 h-4 w-px bg-black/10" />
          <button type="button" onClick={() => scrollToPage(Math.max(0, page - 1))} disabled={page === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/5 disabled:opacity-35" aria-label="上一页"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => scrollToPage(Math.min(pages.length - 1, page + 1))} disabled={page === pages.length - 1} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition hover:bg-black/5 disabled:opacity-35" aria-label="下一页"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div ref={scrollContainerRef} className="h-[min(72vh,760px)] min-h-[520px] overflow-auto overscroll-contain p-4 sm:p-6">
        <div className="flex w-full flex-col items-center gap-5 sm:gap-6">
          {pages.map((source, index) => (
            <div key={source} ref={(element) => { pageRefs.current[index] = element; }} data-page-index={index} className="w-full scroll-mt-4">
              <Image src={source} alt={`${title}，第 ${index + 1} 页`} width={pageSize.width} height={pageSize.height} draggable={false} className="mx-auto h-auto max-w-none rounded-sm bg-white shadow-sm transition-[width] duration-300" style={{ width: `${scale}%` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
