"use client";

import { useState } from "react";
import { ArrowUp, Bot, Sparkles } from "lucide-react";
import { processTeaTurn } from "@/lib/tea-conversation";
import { ExecutionPanel } from "@/components/tea-demo/ExecutionPanel";
import { ProductRecommendation } from "@/components/tea-demo/ProductRecommendation";
import { SourceList } from "@/components/tea-demo/SourceList";
import type { ChatMessage, ExecutionStep, TeaConversationState } from "@/types/tea";

const exampleQuestions = [
  "预算 500，送长辈，有什么推荐？",
  "我想喝红茶，小一点的",
  "不要礼盒，200 以内推荐什么？",
  "桂花的都有什么？",
];

export function TeaChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: "你好，我是「一叶春山」知识库 POC 导购。你可以告诉我预算、送礼对象、口感偏好，或询问已收录商品与冲泡方式。" },
  ]);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [conversationState, setConversationState] = useState<TeaConversationState>({});
  const [responseMode, setResponseMode] = useState<"live-rag" | "structured" | "fallback" | "rag-unavailable">("structured");
  const [isSending, setIsSending] = useState(false);

  async function submitQuestion() {
    const question = input.trim();
    if (!question || isSending) return;
    const conversationContext = {
      priorUserQueries: messages.filter((message) => message.role === "user").map((message) => message.content).slice(-6),
      priorAnswers: messages.flatMap((message) => message.answer ? [message.answer] : []).slice(-6),
    };
    setIsSending(true);
    const submittedAt = performance.now();
    let turn = processTeaTurn(question, conversationState, conversationContext);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: question }]);
    setSteps([
      { label: "接收用户问题", detail: "已收到本轮输入", status: "completed" },
      { label: "识别需求", detail: "正在完成本地意图与条件识别", status: "pending" },
      { label: "检索项目资料", detail: "正在检索已缓存的知识索引", status: "pending" },
      { label: "匹配商品与规则", detail: "等待检索结果", status: "pending" },
      { label: "生成回答", detail: "等待模型或结构化结果", status: "pending" },
      { label: "返回参考资料", detail: "等待引用整理", status: "pending" },
    ]);
    try {
      const response = await fetch("/api/tea-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, conversationState, conversationContext }) });
      if (response.ok) turn = await response.json();
    } catch {
      // 网络或服务端不可用时继续使用本地 Phase 3.5 规则结果。
    }
    const answer = turn.answer;
    setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", content: answer.answer, answer }]);
    setSteps(answer.execution);
    setConversationState(turn.state);
    setResponseMode(answer.mode ?? "fallback");
    setInput("");
    setIsSending(false);
    if (process.env.NODE_ENV !== "production") console.info("[Tea Assistant Performance]", { frontendTotal: `${Math.round(performance.now() - submittedAt)}ms` });
  }

  return (
    <section id="online-demo" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 lg:px-8 lg:py-24">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="section-kicker">你可以直接试试</p><h2 className="mt-5 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">从一个真实问题开始选茶。</h2></div><p className="max-w-md text-sm leading-7 text-neutral-500">输入预算、送礼对象或口味偏好，AI 导购会从当前商品资料中为你筛选。</p></div>
      <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(330px,0.6fr)] lg:items-start">
        <div className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-black/5 bg-[#f7f8f9] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white"><Bot size={16} /></span><div><p className="text-sm font-medium">一叶春山 · 知识库导购</p><p className="mt-0.5 text-xs text-neutral-500">当前版本 · 项目资料 POC</p></div></div><span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] text-neutral-500">{responseMode === "live-rag" ? "实时 Hybrid RAG" : responseMode === "rag-unavailable" ? "RAG 不可用" : responseMode === "fallback" ? "本地兜底" : "结构化检索"}</span></div>
          <div className="min-h-[440px] space-y-6 p-5 sm:p-6">
            {messages.map((message) => message.role === "user" ? (
              <div key={message.id} className="ml-auto max-w-[88%] rounded-[20px] rounded-tr-sm bg-black px-4 py-3 text-sm leading-6 text-white">{message.content}</div>
            ) : (
              <div key={message.id} className="max-w-[94%]"><div className="rounded-[20px] rounded-tl-sm bg-[#f7f8f9] px-4 py-4 text-sm leading-7 text-neutral-700">{message.content}</div>{message.answer && <div className="pl-1"><ProductRecommendation products={message.answer.recommendations} skus={message.answer.recommendationSkus} /><SourceList sources={message.answer.sources} /></div>}</div>
            ))}
          </div>
          <div className="border-t border-black/5 bg-[#f7f8f9] p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">{exampleQuestions.map((question) => <button key={question} type="button" onClick={() => setInput(question)} className="rounded-full border border-black/10 bg-white px-3 py-2 text-left text-xs leading-5 text-neutral-600 transition hover:border-black/30 hover:text-black">{question}</button>)}</div>
            <div className="mt-4 flex gap-3 rounded-2xl border border-black/10 bg-white p-2 pl-4"><input id="tea-assistant-input" value={input} disabled={isSending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitQuestion(); }} placeholder="输入选茶、产品或冲泡问题…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400 disabled:opacity-50" aria-label="输入问题" /><button type="button" disabled={isSending} onClick={submitQuestion} className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-[#c7ff4d] px-3 text-xs font-semibold text-black transition hover:bg-[#b8ed3f] disabled:opacity-50" aria-label="发送问题"><span>发送</span><ArrowUp size={15} /></button></div>
          </div>
        </div>
        <ExecutionPanel steps={steps} />
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-black/5 bg-[#f7f8f9] p-4 text-sm leading-6 text-neutral-600"><Sparkles className="mt-0.5 shrink-0" size={16} /><p>演示说明：茶品、SKU、价格证据与来源依据项目资料整理；当前仍是个人作品集 POC。未配置实时 Provider、索引缺失或请求失败时，会自动保留本地规则结果。</p></div>
    </section>
  );
}
