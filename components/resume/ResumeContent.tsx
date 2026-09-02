import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  Braces,
  CheckCircle2,
  Layers3,
  Route,
  Sparkles,
} from "lucide-react";
import { siteConfig } from "@/lib/site-config";

const capabilities = [
  {
    icon: Route,
    title: "需求澄清与方案拆解",
    desc: "从业务目标、用户场景、数据边界和验收口径出发，再决定使用 RAG、Agent 或工作流。",
  },
  {
    icon: Layers3,
    title: "AI 解决方案设计",
    desc: "能够把模型能力映射到具体业务流程，并用架构图、数据流和 Demo 解释落地路径。",
  },
  {
    icon: Braces,
    title: "Vibe Coding 与快速 Demo",
    desc: "使用 Next.js / TypeScript 等工具快速构建可演示原型，让方案从文字变成可体验产品。",
  },
  {
    icon: BookOpenCheck,
    title: "POC 测试与边界意识",
    desc: "关注成功用例，也关注无答案、资料冲突、越权请求和风险表达等失败场景。",
  },
] as const;

const projects = [
  {
    no: "01",
    name: "一叶春山 AI 导购 / 客服知识库",
    role: "个人 AI 售前 POC · 方案与原型阶段",
    desc: "围绕选茶推荐与产品问答设计 RAG 知识库 POC，目标是把分散产品资料变成可追溯、可解释的知识服务。",
    contributions: [
      "拆解选茶推荐、产品问答、售后分流三类核心场景，并设计意图识别与响应链路。",
      "规划 RAG 来源引用、知识检索与商品推荐链路；本地检索能力明确标注为作品集 POC。",
      "设计 POC 指标与失败用例，避免使用未经真实测试的数据包装效果。",
    ],
    tags: ["RAG", "Knowledge Base", "商品推荐", "POC"],
    href: "/demo/tea-assistant",
    action: "进入 AI 导购",
  },
  {
    no: "02",
    name: "AI 招投标与方案生成 Agent",
    role: "个人 AI 售前 POC · 多步骤 Agent Workflow",
    desc: "面向售前招投标场景设计多步骤 Agent Workflow，实现招标文件解析、结构化需求提取、企业知识检索、资格匹配、偏离分析与技术响应草稿生成，并通过 Tool Calling 展示任务规划和执行过程。",
    contributions: [
      "将招投标分析拆成文件解析、需求抽取、Planner、工具检索、规则匹配与人工复核，而非单次摘要。",
      "以 Structured Planner + Tool Registry 让模型在可用时决定检索工具，并保留确定性回退与可审计执行记录。",
      "用规则引擎计算资格状态、偏离风险与匹配度；所有演示企业资料与案例均明确标为 Synthetic Demo Data。",
    ],
    tags: ["Agent Planning", "Tool Calling", "RAG", "Document Parsing"],
    href: "/demo/tender-agent",
    action: "进入招投标 Agent",
  },
] as const;

const toolkit = [
  ["AI / Agent", "GPT · Claude Code · Cursor · Coze · Dify"],
  ["Web / Demo", "Next.js · TypeScript · Tailwind CSS · Node.js · Express · MySQL"],
  ["交付 / 协作", "GitHub · Vercel · Office · Figma"],
  ["数字媒体", "Photoshop · Illustrator · InDesign · Lightroom · Premiere Pro"],
] as const;

export function ResumeContent() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="section-kicker">个人定位</p>
            <h2 className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-5xl">
              我想做的，不是“会讲模型”的售前，
              <br className="hidden sm:block" />
              而是能把方案真正做出来的人。
            </h2>
          </div>
          <div className="lg:pt-8">
            <p className="max-w-3xl text-lg leading-9 text-neutral-600">
              我的学习路径围绕 AI 售前 / 解决方案工程师展开：先理解业务问题，再做需求拆解、方案设计、Demo 验证与 POC 测试。
              这个网站本身也是一次 Vibe Coding 实践——用可运行的产品证明方案能力，而不是只在简历里写技术关键词。
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-black/5 bg-[#f7f8f9] p-5">
                <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">EDUCATION</p>
                <p className="mt-5 text-xl font-medium tracking-[-0.03em]">南京邮电大学通达学院</p>
                <p className="mt-2 text-sm text-neutral-500">数字媒体技术 · 本科 · 2023.09 — 2027.06</p>
              </div>
              <div className="rounded-[22px] border border-black/5 bg-black p-5 text-white">
                <p className="text-xs font-semibold tracking-[0.16em] text-white/45">TARGET ROLE</p>
                <p className="mt-5 text-xl font-medium tracking-[-0.03em]">AI 售前 / 解决方案工程师</p>
                <p className="mt-2 text-sm text-white/60">关注 AI 应用、企业软件与解决方案类岗位</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f8f9] py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-3xl">
            <p className="section-kicker">核心能力</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">围绕售前完整链路组织能力，而不是简单堆叠技术栈</h2>
          </div>

          <div className="mt-12 grid overflow-hidden rounded-[28px] border border-black/5 bg-white md:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, desc }, index) => (
              <article
                key={title}
                className={`min-h-[270px] p-7 sm:p-8 ${index % 2 === 0 ? "md:border-r md:border-black/5" : ""} ${index < 2 ? "border-b border-black/5" : index === 2 ? "border-b border-black/5 md:border-b-0" : ""}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c7ff4d]">
                  <Icon size={17} />
                </span>
                <h3 className="mt-14 text-2xl font-medium tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-neutral-500">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="projects" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24 lg:px-8 lg:py-32">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker">项目经历</p>
            <h2 className="mt-5 max-w-4xl text-4xl font-medium tracking-[-0.045em] sm:text-5xl">简历里的项目，可以直接进入在线 Demo 继续验证</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-neutral-500">
            当前阶段不包装未完成能力：真实模型、真实 RAG、真实 POC 数据会在后续 Phase 完成后再更新。
          </p>
        </div>

        <div className="mt-12 space-y-5">
          {projects.map((project) => (
            <article key={project.name} className="rounded-[28px] border border-black/5 bg-[#f7f8f9] p-6 sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr] lg:gap-14">
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-[0.18em] text-neutral-400">PROJECT {project.no}</span>
                    <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] text-neutral-500">{project.role}</span>
                  </div>
                  <h3 className="mt-10 text-3xl font-medium leading-tight tracking-[-0.045em]">{project.name}</h3>
                  <p className="mt-4 text-sm leading-7 text-neutral-500">{project.desc}</p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-neutral-600">{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] bg-white p-5 sm:p-7">
                  <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">我的工作</p>
                  <div className="mt-5 space-y-4">
                    {project.contributions.map((item) => (
                      <div key={item} className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
                        <p className="text-sm leading-7 text-neutral-600">{item}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href={project.href}
                    className="mt-7 inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
                  >
                    {project.action} <ArrowUpRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="section-kicker">工具能力</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">工具的价值，是让我更快把方案做成可以沟通、可以验证的东西</h2>
          </div>
          <div className="divide-y divide-black/5 rounded-[26px] border border-black/5 bg-[#f7f8f9] px-5 sm:px-7">
            {toolkit.map(([group, items]) => (
              <div key={group} className="grid gap-3 py-5 sm:grid-cols-[150px_1fr] sm:items-center">
                <p className="text-sm font-medium">{group}</p>
                <p className="text-sm leading-7 text-neutral-500">{items}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8 lg:pb-32">
        <div className="rounded-[30px] border border-black/5 bg-[#f7f8f9] p-7 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <p className="text-xs font-semibold tracking-[0.16em] text-neutral-500">PDF RESUME</p>
            </div>
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">保持联系，或获取正式 PDF 简历</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-500">
              网页简历用于快速了解项目与能力；正式 PDF、代码仓库与邮件入口统一在这里提供。
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-0">
            <a href={siteConfig.links.resumePdf} download className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white">下载 PDF 简历 <ArrowUpRight size={15} /></a>
            <a href={siteConfig.links.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium">GitHub <ArrowUpRight size={15} /></a>
            <a href={siteConfig.links.email} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium">发送邮件 <ArrowUpRight size={15} /></a>
          </div>
        </div>
      </section>
    </>
  );
}
