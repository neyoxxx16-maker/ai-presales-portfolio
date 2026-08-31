import { BadgeInfo, CheckCircle2, CircleDashed } from "lucide-react";

const current = ["基于项目资料整理的茶品、SKU、价格证据与来源注册表", "关键词、场景、规格与价格证据的本地规则检索", "POC 规则意图识别与结构化推荐展示", "无有效来源、资料冲突与未核验价格时明确兜底"];
const later = ["接入企业真实商品资料与知识运营流程", "替换为 Embedding、Vector Search 或 pgvector", "接入真实大模型并增加服务端 API 与评测记录"];

export function PocNotice() {
  return (
    <section className="bg-black py-24 text-white lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20"><div><p className="text-[11px] font-semibold tracking-[0.18em] text-white/45">POC 边界说明</p><h2 className="mt-5 text-4xl font-medium leading-[1.08] tracking-[-0.045em] sm:text-5xl">明确当前实现，才是可信的 POC。</h2><p className="mt-5 max-w-md text-sm leading-7 text-white/60">这个版本用于验证业务体验与信息结构，不将个人作品集 POC 包装成已经上线的企业 AI 系统。</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-[24px] border border-white/10 bg-white/5 p-6"><BadgeInfo className="text-[#c7ff4d]" size={20} /><h3 className="mt-8 text-xl font-medium">当前已实现</h3><ul className="mt-5 space-y-3">{current.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-white/65"><CheckCircle2 className="mt-0.5 shrink-0 text-[#c7ff4d]" size={15} />{item}</li>)}</ul></div><div className="rounded-[24px] border border-white/10 bg-white/5 p-6"><CircleDashed className="text-white/55" size={20} /><h3 className="mt-8 text-xl font-medium">暂未接入</h3><ul className="mt-5 space-y-3">{later.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-white/65"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/45" />{item}</li>)}</ul></div></div></div></div>
    </section>
  );
}
