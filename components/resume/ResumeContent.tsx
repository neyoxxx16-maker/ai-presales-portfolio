import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  Braces,
  CheckCircle2,
  FileText,
  Layers3,
  Route,
  Sparkles,
  Wrench,
} from "lucide-react";

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
    name: "AI 电商内容生成与合规审核 Agent",
    role: "个人 AI 售前 POC · 工作流方案阶段",
    desc: "把商品资料录入、内容生成、参数校验、风险检测、人工确认与导出串成 Step-by-Step Agent 工作台。",
    contributions: [
      "将电商内容生产拆成结构化业务流程，避免把第二个项目做成另一个聊天机器人。",
      "规划 Structured Output 与 Function Calling，用工具校验价格、规格等商品参数一致性。",
      "设计示例风险词检测与人工确认节点，并保留真实业务规则需持续维护的边界说明。",
    ],
    tags: ["Function Calling", "Structured Output", "Workflow", "Vibe Coding"],
    href: "/demo/ecommerce-agent",
    action: "进入电商 Agent",
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
              我想做的不是“会讲模型”的售前，
              <br className="hidden sm:block" />
              而是能把方案做出来的人。
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
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">围绕售前完整链路组织能力，而不是堆技术栈</h2>
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

      <section className="bg-black py-24 text-white lg:py-32">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">方案与交付基础</p>
              <h2 className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-5xl">技术之外，也能整理信息、做方案并完成交付</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <FileText size={20} className="text-[#c7ff4d]" />
                <p className="mt-8 text-xl font-medium">商业方案材料</p>
                <p className="mt-3 text-sm leading-7 text-white/55">
                  整理并输出华文通数字资产平台业务介绍与一叶春山产品白皮书，两份材料合计 23 页，用于信息梳理、层级组织与商业表达训练。
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <Wrench size={20} className="text-[#c7ff4d]" />
                <p className="mt-8 text-xl font-medium">Web 开发基础</p>
                <p className="mt-3 text-sm leading-7 text-white/55">
                  完成过 Node.js + Express + MySQL 的网站项目，具备基础前后端功能梳理、接口理解与系统演示经验。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="section-kicker">工具能力</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">工具是为了更快把方案做成可以沟通的东西</h2>
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
            <h2 className="mt-4 text-3xl font-medium tracking-[-0.04em]">PDF 简历将在内容定稿后开放下载</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-500">
              当前先完成网页简历的信息结构，避免放置不存在的下载文件。后续补入正式 PDF 后，这里会直接提供下载入口。
            </p>
          </div>
          <div className="mt-6 inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm text-neutral-400 lg:mt-0">
            <FileText size={15} /> PDF 待补充
          </div>
        </div>
      </section>
    </>
  );
}
