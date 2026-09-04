import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function AboutStrip() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.4fr] lg:items-center">
        <div>
          <p className="section-kicker">在线简历</p>
          <Link href="/resume" className="mt-8 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white">
            了解我 <ArrowRight size={15} />
          </Link>
        </div>
        <div>
          <h2 className="text-4xl font-medium leading-[1.08] tracking-[-0.05em] sm:text-5xl lg:text-6xl">这是我的求职作品，也是一次完整的 Vibe Coding 实践</h2>
          <p className="mt-6 max-w-3xl text-base leading-8 text-neutral-500">网站会持续更新真实项目资料、架构图和测试结果。</p>
        </div>
      </div>
    </section>
  );
}
