import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const navItems = [
  ["首页", "/"],
  ["在线简历", "/resume"],
  ["AI导购", "/demo/tea-assistant"],
  ["招投标 Agent", "/demo/tender-agent"],
] as const;

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm text-white">HN</span>
          <span>黄念红 · AI售前</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-neutral-600 lg:flex">
          {navItems.map(([label, href]) => (
            <Link key={href} href={href} className="transition hover:text-black">
              {label}
            </Link>
          ))}
        </nav>

        <Link
          href="/demo/tender-agent"
          className="inline-flex items-center gap-2 rounded-full bg-[#c7ff4d] px-4 py-2 text-sm font-medium text-black transition hover:translate-y-[-1px]"
        >
          体验招投标 Agent <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
