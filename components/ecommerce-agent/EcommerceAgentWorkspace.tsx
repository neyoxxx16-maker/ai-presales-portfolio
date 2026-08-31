"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clipboard, Download, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import type { EcommerceAgentRequest, EcommerceAgentResult, EcommerceTaskType } from "@/types/ecommerce-agent";

type ProductOption = { skuId: string; skuName: string; specification: string; netContent: string; packaging: string; price?: { amount: number; label: string; originalPrice?: number } };
const tasks: Array<{ value: EcommerceTaskType; label: string; description: string }> = [
  { value: "selling_points", label: "商品卖点文案", description: "适合商品卡、主图旁卖点" },
  { value: "xiaohongshu", label: "小红书种草文案", description: "适合内容平台的体验表达" },
  { value: "product_detail", label: "商品详情页文案", description: "适合详情页首屏与卖点模块" },
  { value: "customer_service", label: "客服推荐话术", description: "适合咨询中的推荐回复" },
];

const initialRequest: EcommerceAgentRequest = { skuId: "", taskType: "selling_points", style: "自然、克制", audience: "喜欢清爽茶香的办公室人群", scene: "午后自饮", length: "约120字", requirements: "" };
const statusText = { ready_for_review: "待人工确认", needs_revision: "需要修订", blocked: "阻止采用" };

function formatPrice(product?: ProductOption) { return product?.price ? `${product.price.label} ¥${product.price.amount}${product.price.originalPrice ? ` · 划线价 ¥${product.price.originalPrice}` : ""}` : "价格资料未提供"; }

export function EcommerceAgentWorkspace() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState<EcommerceAgentRequest>(initialRequest);
  const [result, setResult] = useState<EcommerceAgentResult>();
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetch("/api/ecommerce-agent").then(async (response) => response.ok ? response.json() : Promise.reject()).then((data: { products: ProductOption[] }) => setProducts(data.products)).catch(() => setError("商品资料暂时无法读取，请刷新后重试。")); }, []);
  const selectedProduct = products.find((product) => product.skuId === form.skuId);
  const update = (key: keyof EcommerceAgentRequest, value: string) => { setForm((current) => ({ ...current, [key]: value })); setIsConfirmed(false); };

  async function generate() {
    if (isRunning) return;
    if (!form.skuId) { setError("请先选择一个已验证商品。"); return; }
    setError(""); setResult(undefined); setIsConfirmed(false); setIsRunning(true);
    try {
      const response = await fetch("/api/ecommerce-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json() as EcommerceAgentResult & { message?: string };
      if (!response.ok) throw new Error(data.message || "本次生成未完成，请稍后重试。");
      setResult(data);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "本次生成未完成，请稍后重试。"); } finally { setIsRunning(false); }
  }

  async function copyResult() { if (!result) return; await navigator.clipboard?.writeText(result.generatedContent); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
  function exportResult() { if (!result) return; const text = `# ${tasks.find((task) => task.value === result.taskType)?.label}\n\n${result.generatedContent}\n\n## 已验证商品事实\n${result.verifiedFacts.map((fact) => `- ${fact}`).join("\n")}\n\n## 审核结果\n- 参数校验：${result.validation.passed ? "通过" : "发现问题"}\n- 风险等级：${result.riskReview.level}\n- 状态：${statusText[result.status]}`; const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${result.product.skuName}-审核文案.md`; link.click(); URL.revokeObjectURL(url); }

  return (
    <section className="bg-[#f7f8f9] py-14 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-4xl"><p className="section-kicker">Ecommerce Agent Workflow Demo</p><h1 className="mt-4 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">让商品文案先经过事实与风险审核，再交给人确认。</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-500">选择已验证 SKU 与内容任务。Agent 会在服务端调用商品事实工具，生成候选文案，并完成参数一致性与风险审核；它不会自动发布。</p></div>
        <div className="mt-10 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-center gap-2"><Sparkles size={16} /><h2 className="font-medium">任务配置</h2></div>
            <label className="mt-6 block text-xs font-medium text-neutral-600">已验证商品 SKU<select value={form.skuId} onChange={(event) => update("skuId", event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-black outline-none focus:border-black"><option value="">请选择商品</option>{products.map((product) => <option key={product.skuId} value={product.skuId}>{product.skuName} · {product.netContent}</option>)}</select></label>
            {selectedProduct && <div className="mt-3 rounded-2xl bg-[#f7f8f9] p-3 text-xs leading-6 text-neutral-600"><p className="font-medium text-neutral-900">{selectedProduct.skuName}</p><p>{selectedProduct.specification} · {selectedProduct.packaging}</p><p>{formatPrice(selectedProduct)}</p></div>}
            <p className="mt-6 text-xs font-medium text-neutral-600">内容任务</p><div className="mt-2 grid gap-2">{tasks.map((task) => <button key={task.value} type="button" onClick={() => update("taskType", task.value)} className={`rounded-xl border p-3 text-left transition ${form.taskType === task.value ? "border-black bg-black text-white" : "border-black/10 hover:border-black/30"}`}><span className="block text-sm font-medium">{task.label}</span><span className={`mt-1 block text-[11px] ${form.taskType === task.value ? "text-white/60" : "text-neutral-500"}`}>{task.description}</span></button>)}</div>
            <div className="mt-6 grid gap-3"><Input label="表达风格" value={form.style ?? ""} onChange={(value) => update("style", value)} placeholder="如：克制、生活化" /><Input label="目标人群" value={form.audience ?? ""} onChange={(value) => update("audience", value)} placeholder="如：送礼人群" /><Input label="使用场景" value={form.scene ?? ""} onChange={(value) => update("scene", value)} placeholder="如：下午茶" /><Input label="长度要求" value={form.length ?? ""} onChange={(value) => update("length", value)} placeholder="如：约120字" /><label className="block text-xs font-medium text-neutral-600">其他补充<textarea value={form.requirements ?? ""} onChange={(event) => update("requirements", event.target.value)} placeholder="可选" rows={3} className="mt-2 w-full resize-none rounded-xl border border-black/10 px-3 py-2.5 text-sm font-normal outline-none focus:border-black" /></label></div>
            <button type="button" onClick={generate} disabled={isRunning} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#c7ff4d] px-4 py-3 text-sm font-medium transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60">{isRunning ? <LoaderCircle className="animate-spin" size={16} /> : <Workflow size={16} />}{isRunning ? "Agent 正在执行…" : "生成并审核"}</button>
          </aside>
          <div className="space-y-5">
            <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">Agent 执行轨迹</p><p className="mt-1 text-xs text-neutral-500">每一步均由服务端实际执行后回传。</p></div>{result && <span className="rounded-full bg-[#edf7d5] px-3 py-1.5 text-xs font-medium">{statusText[result.status]}</span>}</div><div className="mt-6 grid gap-3 md:grid-cols-5">{(result?.workflow ?? ["获取商品事实", "生成候选内容", "参数一致性校验", "风险审核", "结构化结果"]).map((step, index) => { const completed = typeof step !== "string"; const label = completed ? step.label : step; return <div key={label} className={`rounded-2xl border p-3 ${completed ? "border-black/10 bg-[#f7f8f9]" : "border-dashed border-black/10 text-neutral-400"}`}><div className="flex items-center justify-between"><span className="text-[11px] font-medium">0{index + 1}</span>{completed ? <CheckCircle2 size={15} className="text-emerald-600" /> : null}</div><p className="mt-4 text-xs font-medium leading-5">{label}</p>{completed && <p className="mt-1 text-[11px] leading-5 text-neutral-500">{step.detail}</p>}</div>; })}</div>{isRunning && <p className="mt-5 rounded-xl bg-[#f7f8f9] px-4 py-3 text-sm text-neutral-600">正在调用商品事实与内容审核工具，请稍候。</p>}</section>
            {error && <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{error}</div>}
            {result ? <ResultPanel result={result} confirmed={isConfirmed} onConfirm={() => setIsConfirmed(true)} onCopy={copyResult} onExport={exportResult} copied={copied} onRegenerate={generate} /> : <section className="flex min-h-[360px] flex-col justify-center rounded-[28px] border border-dashed border-black/10 bg-white p-8 text-center"><ShieldCheck className="mx-auto text-neutral-300" size={34} /><h2 className="mt-4 text-lg font-medium">等待一次可审核的内容任务</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">生成后，这里会展示文案、来源于商品资料的事实、参数校验、风险结论和人工确认动作。</p></section>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block text-xs font-medium text-neutral-600">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm font-normal text-black outline-none focus:border-black" /></label>; }

function ResultPanel({ result, confirmed, onConfirm, onCopy, onExport, copied, onRegenerate }: { result: EcommerceAgentResult; confirmed: boolean; onConfirm: () => void; onCopy: () => void; onExport: () => void; copied: boolean; onRegenerate: () => void }) {
  const blocked = result.status !== "ready_for_review";
  return <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-medium">审核结果</p><h2 className="mt-2 text-2xl font-medium tracking-[-0.04em]">{confirmed ? "已确认采用" : statusText[result.status]}</h2></div><span className={`rounded-full px-3 py-1.5 text-xs font-medium ${result.riskReview.level === "low" ? "bg-[#edf7d5]" : result.riskReview.level === "attention" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800"}`}>{result.riskReview.level === "low" ? "低风险" : result.riskReview.level === "attention" ? "需注意" : "阻止发布"}</span></div><div className="mt-6 rounded-2xl bg-[#f7f8f9] p-5 text-sm leading-7 text-neutral-800 whitespace-pre-wrap">{result.generatedContent}</div><div className="mt-5 grid gap-4 lg:grid-cols-2"><ReviewCard title="已验证商品事实" icon={<CheckCircle2 size={16} className="text-emerald-600" />}><ul className="space-y-2 text-sm leading-6 text-neutral-600">{result.verifiedFacts.map((fact) => <li key={fact}>• {fact}</li>)}</ul></ReviewCard><ReviewCard title={result.validation.passed ? "参数一致性检查：通过" : `参数一致性检查发现 ${result.validation.issues.length} 个问题`} icon={result.validation.passed ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-red-600" />}><p className="text-xs leading-5 text-neutral-500">已检查：{result.validation.checkedFields.join("、")}</p>{result.validation.issues.map((issue) => <p key={issue.message} className="mt-2 text-sm leading-6 text-red-700">{issue.field}：{issue.message}</p>)}</ReviewCard><ReviewCard title="风险审核" icon={<ShieldCheck size={16} className="text-neutral-700" />}><p className="text-sm text-neutral-600">{result.riskReview.issues.length ? result.riskReview.issues.map((issue) => issue.message).join(" ") : "未发现无依据商品声明、绝对化承诺或参数冲突。"}</p><p className="mt-2 text-xs leading-5 text-neutral-500">{result.riskReview.suggestions.join(" ")}</p></ReviewCard><ReviewCard title="人工确认" icon={<Check size={16} className="text-neutral-700" />}><p className="text-sm leading-6 text-neutral-600">AI 只生成和辅助审核；商业内容须由人工确认后采用。</p></ReviewCard></div><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={onConfirm} disabled={blocked || confirmed} className="rounded-full bg-black px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{confirmed ? "已确认" : "确认采用"}</button><button type="button" onClick={onRegenerate} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium"><RefreshCw size={15} />重新生成 / 修改</button><button type="button" onClick={onCopy} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium"><Clipboard size={15} />{copied ? "已复制" : "复制结果"}</button><button type="button" onClick={onExport} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium"><Download size={15} />导出 Markdown</button></div>{blocked && <p className="mt-3 text-xs leading-5 text-neutral-500">当前结果存在待修订项，因此不能确认采用；请修改要求后重新生成。</p>}</section>;
}

function ReviewCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <div className="rounded-2xl border border-black/5 p-4"><div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div><div className="mt-3">{children}</div></div>; }
