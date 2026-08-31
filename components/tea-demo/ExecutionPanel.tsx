import { Check, CircleAlert, Clock3, ScanSearch } from "lucide-react";
import type { ExecutionStep } from "@/types/tea";

export function ExecutionPanel({ steps }: { steps: ExecutionStep[] }) {
  const completed = steps.length > 0 && steps.every((step) => step.status !== "pending");
  return (
    <aside className="rounded-[28px] border border-black/5 bg-[#f7f8f9] p-5 sm:p-6 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-5">
        <div><p className="section-kicker">本轮可观察步骤</p><h3 className="mt-2 text-2xl font-medium tracking-[-0.04em]">AI 执行过程</h3></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${completed ? "bg-[#c7ff4d] text-black" : "bg-white text-neutral-500"}`}>{completed ? <Check size={13} /> : <Clock3 size={13} />}{completed ? "已完成" : "等待提问"}</span>
      </div>
      <p className="mt-4 text-xs leading-5 text-neutral-500">展示产品可解释步骤，不展示模型内部推理。当前为 POC 规则识别与项目资料本地检索。</p>
      <div className="mt-6 space-y-1">
        {steps.length ? steps.map((step, index) => {
          const Icon = step.status === "empty" ? CircleAlert : step.status === "pending" ? Clock3 : Check;
          return <div key={`${step.label}-${index}`} className="flex gap-3 rounded-2xl px-3 py-3"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step.status === "empty" ? "bg-white text-neutral-500" : "bg-black text-white"}`}><Icon size={13} /></span><div><p className="text-sm font-medium">{step.label}</p>{step.detail && <p className="mt-1 text-xs leading-5 text-neutral-500">{step.detail}</p>}</div></div>;
        }) : <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5 text-sm leading-6 text-neutral-500"><ScanSearch className="mb-3" size={18} />提交一个问题后，这里会展示识别、检索与结果生成步骤。</div>}
      </div>
    </aside>
  );
}
