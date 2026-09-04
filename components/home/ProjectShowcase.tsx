import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const projects = [
  {
    no: "01",
    title: "项目一：AI 导购",
    desc: "围绕选茶推荐与产品问答，展示商品知识检索、来源引用与 POC 验证。",
    tags: ["RAG", "Knowledge Base", "POC"],
    href: "/demo/tea-assistant",
  },
  {
    no: "02",
    title: "项目二：招投标 Agent",
    desc: "让 Agent 自动解析招标文件，调用企业知识与工具完成需求提取、资格匹配、偏离分析和技术响应建议。",
    tags: ["Agent", "Tool Calling", "RAG", "OCR"],
    href: "/demo/tender-agent",
  },
] as const;

export function ProjectShowcase() {
  return (
    <section className="bg-[#f7f8f9] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker">核心项目</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-medium tracking-[-0.045em] sm:text-5xl">不是一个PPT，是一个能点的Demo</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-neutral-500">一个做对话式知识问答，一个做流程自动化，两个项目拼在一起，就是完整的售前方案能力。</p>
        </div>

        <div data-reveal-group className="mt-14 grid gap-5 lg:mt-16 lg:grid-cols-2">
          {projects.map((project) => (
            <Link
              href={project.href}
              key={project.title}
              data-reveal-item
              className="group rounded-[28px] border border-black/5 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-soft sm:p-8"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.18em] text-neutral-400">PROJECT {project.no}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition group-hover:bg-[#c7ff4d] group-hover:text-black">
                  <ArrowUpRight size={17} />
                </span>
              </div>
              <h3 className="mt-16 max-w-xl text-3xl font-medium tracking-[-0.045em]">{project.title}</h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-500">{project.desc}</p>
              <div className="mt-8 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-neutral-600">{tag}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
