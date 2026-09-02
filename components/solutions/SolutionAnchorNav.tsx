"use client";

import { useEffect, useState } from "react";

const items = [
  { label: "核心 POC", href: "#core-poc", sections: ["core-poc"] },
  { label: "方案设计", href: "#solution-design", sections: ["solution-design", "solution-architecture"] },
  { label: "业务判断", href: "#business-thinking", sections: ["business-thinking"] },
  { label: "价值验证", href: "#value-validation", sections: ["value-validation", "roi", "poc"] },
  { label: "项目复盘", href: "#project-review", sections: ["project-review", "retrospectives"] },
  { label: "交付材料", href: "#deliverables", sections: ["deliverables"] },
] as const;

export function SolutionAnchorNav() {
  const [activeHref, setActiveHref] = useState<(typeof items)[number]["href"]>("#core-poc");

  useEffect(() => {
    const targets = items.flatMap((item) => item.sections.map((id) => document.getElementById(id))).filter((element): element is HTMLElement => Boolean(element));
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleTarget = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]?.target as HTMLElement | undefined;
        if (!visibleTarget) return;

        const nextItem = items.find((item) => (item.sections as readonly string[]).includes(visibleTarget.id));
        if (nextItem) setActiveHref(nextItem.href);
      },
      { rootMargin: "-32% 0px -58%", threshold: 0 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const handleNavigate = (event: React.MouseEvent<HTMLAnchorElement>, href: (typeof items)[number]["href"]) => {
    event.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", href);
  };

  return (
    <div className="sticky top-[105px] z-40 border-b border-black/5 bg-white/95 backdrop-blur-xl lg:top-[65px]">
      <nav aria-label="方案展示页面导航" className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-5 py-3 text-sm whitespace-nowrap lg:px-8">
        {items.map(({ label, href }) => {
          const active = activeHref === href;
          return <a key={href} href={href} onClick={(event) => handleNavigate(event, href)} aria-current={active ? "location" : undefined} className={`relative shrink-0 py-1.5 transition-colors after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-5 after:-translate-x-1/2 after:rounded-full after:bg-[#c7ff4d] after:transition-transform ${active ? "font-semibold text-neutral-950 after:scale-x-100" : "text-neutral-500 hover:text-black after:scale-x-0"}`}>{label}</a>;
        })}
      </nav>
    </div>
  );
}
