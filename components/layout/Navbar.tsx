"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

const navItems = [
  ["首页", "/"],
  ["在线简历", "/resume"],
  ["AI导购", "/demo/tea-assistant"],
  ["招投标 Agent", "/demo/tender-agent"],
  ["方案展示", "/solutions"],
] as const;

export function Navbar() {
  const pathname = usePathname();
  const isActive = (href: (typeof navItems)[number][1]) =>
    href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm text-white">HN</span>
          <span>黄念红 · AI售前</span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-7 text-sm text-neutral-600 lg:flex">
          {navItems.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`relative py-1 transition-colors duration-200 hover:text-black after:absolute after:bottom-[-8px] after:left-1/2 after:h-0.5 after:w-5 after:-translate-x-1/2 after:rounded-full after:bg-[#c7ff4d] after:transition-transform after:duration-300 after:ease-out ${
                isActive(href)
                  ? "font-semibold text-neutral-950 after:scale-x-100"
                  : "font-normal after:scale-x-0"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <Link
          href="/demo/tender-agent"
          className="inline-flex items-center gap-2 rounded-full bg-[#c7ff4d] px-4 py-2 text-sm font-medium text-black transition duration-300 hover:translate-y-[-1px]"
        >
          体验招投标 Agent <ArrowUpRight className="button-arrow" size={15} />
        </Link>
      </div>
      <nav aria-label="移动端主导航" className="flex gap-5 overflow-x-auto border-t border-black/[0.04] px-5 pb-3 pt-2 text-xs text-neutral-600 lg:hidden">
        {navItems.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`relative shrink-0 py-1.5 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-5 after:rounded-full after:bg-[#c7ff4d] after:transition-transform after:duration-300 after:ease-out ${
              isActive(href)
                ? "font-semibold text-neutral-950 after:scale-x-100"
                : "hover:text-black after:scale-x-0"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
