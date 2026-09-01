"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FileSearch,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { TenderFileDropzone } from "@/components/tender-agent/TenderFileDropzone";
import { TenderCompanyLibraryManager } from "@/components/tender-agent/TenderCompanyLibraryManager";
import { companyLibraryOverview } from "@/data/tender/knowledge";
import type {
  CompanyWorkspaceMode,
  MatchStatus,
  RequirementMatch,
  RiskLevel,
  TenderAgentResult,
  TenderSource,
} from "@/types/tender-agent";

type Tab =
  | "overview"
  | "qualification"
  | "technical"
  | "scoring"
  | "response"
  | "library";
type ConversationMessage = { role: "user" | "assistant"; content: string; sources?: TenderSource[] };
type StoredTenderSession = { id: string; fileNames: string[]; result?: TenderAgentResult; conversation: ConversationMessage[]; updatedAt: string };
const createAnalysisSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tender-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const statusLabel: Record<MatchStatus, string> = {
  PASS: "符合",
  PENDING: "待确认",
  MISSING_EVIDENCE: "资料缺失",
  FAIL: "明确不符合",
};
const statusStyle: Record<MatchStatus, string> = {
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  MISSING_EVIDENCE: "border-orange-200 bg-orange-50 text-orange-900",
  FAIL: "border-red-200 bg-red-50 text-red-800",
};
const riskLabel: Record<RiskLevel, string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
};
const riskStyle: Record<RiskLevel, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-900",
  HIGH: "bg-red-100 text-red-800",
};
const badge =
  "inline-flex h-7 min-w-[5.5rem] items-center justify-center whitespace-nowrap rounded-full border px-3 text-[11px] font-medium leading-none";

function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span className={`${badge} ${statusStyle[status]}`}>
      {statusLabel[status]}
    </span>
  );
}
function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={`inline-flex h-7 min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded-full px-3 text-[11px] font-medium leading-none ${riskStyle[risk]}`}
    >
      {riskLabel[risk]}
    </span>
  );
}
function Evidence({ sources, judgment }: { sources: TenderSource[]; judgment?: string }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-neutral-500">
        查看证据（{sources.length}）
      </summary>
      <div className="mt-2 space-y-2">
        {sources.length ? (
          sources.map((source) => (
            <div
              key={`${source.id}-${source.location}`}
              className="rounded-xl border border-black/5 bg-white px-3 py-2"
            >
              <p className="font-medium text-neutral-700">
                来源：{source.sourceFile || source.documentName || source.title}
                {source.pageNumber ?? source.page ? ` · 第 ${source.pageNumber ?? source.page} 页` : source.category === "招标文件" ? " · 页码未定位" : ""}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                原文：“{source.quote || source.excerpt}”
              </p>
              <p className="mt-1 text-[10px] text-neutral-400">
                判断来源：{source.category}
                {source.chunkId ? ` · 片段 ${source.chunkId}` : ""}
              </p>
              {judgment && <p className="mt-1 text-[11px] leading-5 text-neutral-600">判断：{judgment}</p>}
            </div>
          ))
        ) : (
          <p className="text-neutral-400">暂无有效证据</p>
        )}
      </div>
    </details>
  );
}
function InlineMarkdown({ value }: { value: string }) {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : part.startsWith("`") && part.endsWith("`") ? (
          <code key={index} className="rounded bg-black/5 px-1 py-0.5">{part.slice(1, -1)}</code>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
/** Deliberately renders text nodes only; model output is never injected as HTML. */
function MarkdownText({ value }: { value: string }) {
  const blocks: ReactNode[] = [];
  const lines = value.replace(/\r/g, "").split("\n");
  let list: Array<{ ordered: boolean; content: string }> = [];
  const flush = () => {
    if (!list.length) return;
    const ordered = list[0].ordered;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(<Tag key={`list-${blocks.length}`} className={`my-1 space-y-1 ${ordered ? "list-decimal pl-5" : "list-disc pl-5"}`}>{list.map((item, index) => <li key={index}><InlineMarkdown value={item.content} /></li>)}</Tag>);
    list = [];
  };
  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || ordered) {
      list.push({ ordered: Boolean(ordered), content: (bullet ?? ordered)![1] });
      return;
    }
    flush();
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    blocks.push(heading ? <p key={index} className="mt-2 font-medium"><InlineMarkdown value={heading[1]} /></p> : <p key={index} className={line ? "" : "h-2"}>{line && <InlineMarkdown value={line} />}</p>);
  });
  flush();
  return <div>{blocks}</div>;
}

export function TenderAgentWorkspace() {
  const [result, setResult] = useState<TenderAgentResult>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [companyMode, setCompanyMode] = useState<CompanyWorkspaceMode>("demo");
  const [task, setTask] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [analysisStale, setAnalysisStale] = useState(false);
  const [askingAgent, setAskingAgent] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [showLatestMessage, setShowLatestMessage] = useState(false);
  const [analysisSessionId, setAnalysisSessionId] = useState(createAnalysisSessionId);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const latestUserRef = useRef<HTMLDivElement>(null);
  const latestAssistantRef = useRef<HTMLDivElement>(null);
  const shouldAutoFollowRef = useRef(true);
  const forceScrollToLatestRef = useRef(false);
  const scrollTargetRef = useRef<"user" | "assistant">("user");
  const sessionsRef = useRef<Record<string, StoredTenderSession>>({});
  useEffect(() => {
    if (!askingAgent && !conversation.length) return;
    const container = chatScrollRef.current;
    const target = scrollTargetRef.current === "assistant" ? latestAssistantRef.current : latestUserRef.current;
    if (container && (forceScrollToLatestRef.current || shouldAutoFollowRef.current)) {
      container.scrollTo({ top: Math.max(0, (target?.offsetTop ?? 0) - container.offsetTop - 8), behavior: "smooth" });
      forceScrollToLatestRef.current = false;
      setShowLatestMessage(false);
    } else if (!container && (forceScrollToLatestRef.current || shouldAutoFollowRef.current)) {
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      forceScrollToLatestRef.current = false;
      setShowLatestMessage(false);
    } else setShowLatestMessage(true);
  }, [askingAgent, conversation.length]);
  function handleChatScroll() {
    const container = chatScrollRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 56;
    shouldAutoFollowRef.current = nearBottom;
    if (nearBottom) setShowLatestMessage(false);
  }
  function scrollToLatestMessage() {
    forceScrollToLatestRef.current = true;
    shouldAutoFollowRef.current = true;
    const container = chatScrollRef.current;
    const target = latestAssistantRef.current ?? latestUserRef.current;
    if (container) container.scrollTo({ top: Math.max(0, (target?.offsetTop ?? 0) - container.offsetTop - 8), behavior: "smooth" });
    else target?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowLatestMessage(false);
  }
  useEffect(() => {
    const session: StoredTenderSession = { id: analysisSessionId, fileNames: uploadedFiles.map((file) => file.name), result, conversation, updatedAt: new Date().toISOString() };
    sessionsRef.current[analysisSessionId] = session;
    try { sessionStorage.setItem("tender-agent-sessions", JSON.stringify(sessionsRef.current)); } catch { /* Storage is optional; request context remains session-scoped. */ }
  }, [analysisSessionId, conversation, result, uploadedFiles]);
  function beginNewSession() {
    setAnalysisSessionId(createAnalysisSessionId());
    setResult(undefined);
    setConversation([]);
    setTask("");
    setAnalysisStale(false);
    setReviewedIds([]);
    setShowLatestMessage(false);
  }
  async function startAnalysis() {
    if (!uploadedFiles.length || running) return;
    setRunning(true);
    setError("");
    setReviewedIds([]);
    try {
      const body = new FormData();
      uploadedFiles.forEach((file) => body.append("file", file));
      body.append("companyMode", companyMode);
      body.append("action", "analyze");
      const response = await fetch("/api/tender-agent", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        result?: TenderAgentResult;
        message?: string;
      };
      if (!response.ok || !data.result)
        throw new Error(data.message || "分析未完成。");
      setResult(data.result);
      setAnalysisStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析未完成。");
    } finally {
      setRunning(false);
    }
  }
  async function askAgent() {
    if (!result) {
      setError("请先完成投标分析后再继续询问。");
      return;
    }
    if (running || askingAgent) return;
    const enteredQuestion = task.trim();
    if (!enteredQuestion) {
      setError("请输入需要继续询问的问题。");
      return;
    }
    setAskingAgent(true);
    setSearchingWeb(/最新|当前|现在|今日|最近|官网|公告|政策|市场信息|厂商信息|最新价格|外部公开信息|请联网|联网核验|帮我搜索|查询官网|核验来源|给我链接|来源\s*url/i.test(enteredQuestion));
    setError("");
    forceScrollToLatestRef.current = true;
    shouldAutoFollowRef.current = true;
    scrollTargetRef.current = "user";
    setConversation((messages) => [
      ...messages,
      { role: "user", content: enteredQuestion },
    ]);
    setTask("");
    try {
      const response = await fetch("/api/tender-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "question",
          task: enteredQuestion,
          result,
          conversation,
          analysisSessionId,
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        message?: string;
        webSearch?: TenderAgentResult["externalVerification"];
        webEvidence?: TenderSource[];
        trace?: TenderAgentResult["execution"][number];
      };
      if (!response.ok || !data.answer)
        throw new Error(data.message || "AI 问答未完成。");
      setConversation((messages) => [
        ...messages,
        { role: "assistant", content: data.answer!, sources: data.webEvidence },
      ]);
      scrollTargetRef.current = "assistant";
      if (data.trace || data.webSearch) setResult((current) => current ? {
        ...current,
        execution: data.trace ? [...current.execution, data.trace] : current.execution,
        externalVerification: data.webSearch ?? current.externalVerification,
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 分析未完成。");
    } finally {
      setAskingAgent(false);
      setSearchingWeb(false);
    }
  }
  function toggleReview(id: string) {
    setReviewedIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }
  function exportResult() {
    if (!result) return;
    const text = `# 投标分析建议\n\n## 应标准备度\n${result.analysisSummary.readinessScore}%\n${result.analysisSummary.readinessFormula}\n\n## 逐条判断\n${result.matches.map((item) => `- [${statusLabel[item.status]}] ${item.requirement}\n  - 依据：${item.reason}\n  - 证据：${item.evidenceIds.join("、") || "无"}\n  - 建议：${item.suggestedAction}`).join("\n")}\n\n## 人工确认\n${result.notice}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "投标分析建议.md";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="bg-[#f7f8f9] py-14 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="max-w-4xl">
          <p className="section-kicker">AI Tender & Solution Agent · Phase 5</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-medium tracking-[-0.05em] sm:text-6xl">
              AI 招投标与方案生成 Agent
            </h1>
            {result && (
              <button
                onClick={() => setTraceOpen(true)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium"
              >
                查看 Agent 轨迹
              </button>
            )}
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-500">
            从招标文件出发，完成需求分类、企业证据核验、风险识别与技术应答草稿生成。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setCompanyMode("demo")}
              className={`rounded-full px-3 py-1.5 text-xs ${companyMode === "demo" ? "bg-black text-white" : "border border-black/10 text-neutral-600"}`}
            >
              演示企业资料
            </button>
            <button
              onClick={() => setCompanyMode("workspace")}
              className={`rounded-full px-3 py-1.5 text-xs ${companyMode === "workspace" ? "bg-black text-white" : "border border-black/10 text-neutral-600"}`}
            >
              真实企业资料
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            {companyMode === "demo"
              ? "当前使用示例供应商资料，仅用于作品集演示。"
              : "当前仅使用本地真实企业资料，不会混入演示资料。"}
          </p>
        </div>
        <div className="mt-10 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="h-fit rounded-[28px] border border-black/5 bg-white p-5 shadow-soft xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto sm:p-6">
            <div className="flex items-center gap-2">
              <FileSearch size={16} />
              <h2 className="font-medium">招标材料输入</h2>
            </div>
            <p className="mt-3 text-xs leading-6 text-neutral-500">
              可一次或分批追加项目资料。文件解析完成后，再手动启动完整投标分析。
            </p>
            <TenderFileDropzone
              companyMode={companyMode}
              onBusy={setRunning}
              onFilesReady={(files) => {
                setError("");
                setReviewedIds([]);
                const removedExistingFile = uploadedFiles.some((file) => !files.some((next) => next.name === file.name && next.size === file.size));
                const onlyAppended = uploadedFiles.length > 0 && uploadedFiles.every((file) => files.some((next) => next.name === file.name && next.size === file.size));
                if (removedExistingFile || (result && !onlyAppended)) beginNewSession();
                else if (result) setAnalysisStale(true);
                setUploadedFiles(files);
              }}
            />
            <div className="mt-6 border-t border-black/5 pt-5">
              <p className="text-sm font-medium">整份招标文件自动分析</p>
              <p className="mt-2 text-xs leading-6 text-neutral-500">
                仅在点击后执行企业知识库、资格审查、技术偏离、评分、技术应答与综合投标判断。
              </p>
              <button
                onClick={startAnalysis}
                type="button"
                disabled={running || !uploadedFiles.length}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#c7ff4d] px-4 py-3 text-sm font-medium disabled:opacity-50"
              >
                <Sparkles size={16} />
                {running ? "分析中…" : analysisStale ? "重新分析" : "开始投标分析"}
              </button>
            </div>
            {result && (
              <div className="mt-6 border-t border-black/5 pt-5">
                <p className="text-sm font-medium">继续询问 Agent</p>
                <div className="mt-3 shrink-0">
                  <textarea
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                    placeholder="询问本项目，例如：我们公司能投吗？最容易废标的三项是什么？"
                    className="min-h-24 w-full rounded-xl border border-black/10 bg-[#f7f8f9] p-3 text-xs leading-5 outline-none focus:border-black/30"
                  />
                  <button
                    onClick={askAgent}
                    type="button"
                    disabled={running || askingAgent || !task.trim()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-black/10 px-4 py-3 text-sm font-medium disabled:opacity-50"
                  >
                    <Sparkles size={16} />
                    {askingAgent ? "Agent 正在分析…" : "发送"}
                  </button>
                </div>
                {(conversation.length > 0 || askingAgent) && (
                  <div ref={chatScrollRef} onScroll={handleChatScroll} className="tender-chat-scroll mt-4 max-h-[min(34rem,calc(100vh-27rem))] space-y-3 overflow-y-auto overscroll-contain border-y border-black/5 py-4 pr-2 text-xs leading-6">
                    {conversation.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        ref={message.role === "assistant" && index === conversation.length - 1 ? latestAssistantRef : message.role === "user" && index === conversation.length - 1 ? latestUserRef : undefined}
                        className="scroll-mt-3"
                      >
                        <div className={`rounded-xl p-3 ${message.role === "user" ? "bg-[#f7f8f9] text-neutral-700" : "bg-[#f7ffe8] text-neutral-800"}`}>
                        <p className="font-medium">
                          {message.role === "user" ? "用户" : "AI"}
                        </p>
                        <div className="mt-1"><MarkdownText value={message.content} /></div>
                        {message.sources?.length ? <Evidence sources={message.sources} /> : null}
                        </div>
                      </div>
                    ))}
                    {askingAgent && (
                      <div ref={latestUserRef} className="rounded-xl bg-[#f7ffe8] p-3 text-neutral-800">
                        <p className="font-medium">AI</p>
                        <p className="mt-1 flex items-center gap-2"><LoaderCircle className="animate-spin" size={14} />{searchingWeb ? "正在联网检索并整理结果…" : "正在整理当前项目资料…"}</p>
                      </div>
                    )}
                  </div>
                )}
                {showLatestMessage && (
                  <button
                    type="button"
                    onClick={scrollToLatestMessage}
                    className="mt-3 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-sm"
                  >
                    ↓ 查看最新消息
                  </button>
                )}
              </div>
            )}
            {!result && uploadedFiles.length > 0 && (
              <p className="mt-5 rounded-xl bg-[#f7f8f9] px-3 py-3 text-xs leading-5 text-neutral-500">
                正在分析当前招标文件，完成后即可继续提问。
              </p>
            )}
            <p className="mt-5 text-center text-xs text-neutral-500">
              没有招标文件？{" "}
              <button
                onClick={() => setError("示例入口不参与本轮真实文件验收。")}
                className="font-medium text-neutral-800 underline"
              >
                加载示例
              </button>
            </p>
          </aside>
          <div>
            {running && (
              <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-black/5 bg-white p-8 text-sm text-neutral-600">
                <LoaderCircle className="mr-2 animate-spin" size={18} />
                {uploadedFiles.length
                  ? "正在执行本次投标分析…"
                  : "正在解析招标文件…"}
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                {error}
              </div>
            )}
            {!running && result && (
              <ResultView
                result={result}
                analysisStale={analysisStale}
                reviewedIds={reviewedIds}
                onToggleReview={toggleReview}
                onExport={exportResult}
              />
            )}
            {!running && !result && !error && (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-white p-8 text-center">
                <Workflow size={34} className="text-neutral-300" />
                <h2 className="mt-4 text-lg font-medium">等待招标材料</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                  可先上传并追加多个招标材料，解析完成后点击“开始投标分析”。
                </p>
              </div>
            )}
          </div>
        </div>
        <PortfolioNarrative />
      </div>
      {result && (
        <TraceDrawer
          result={result}
          open={traceOpen}
          onClose={() => setTraceOpen(false)}
        />
      )}
    </section>
  );
}

function ResultView({
  result,
  analysisStale,
  reviewedIds,
  onToggleReview,
  onExport,
}: {
  result: TenderAgentResult;
  analysisStale: boolean;
  reviewedIds: string[];
  onToggleReview: (id: string) => void;
  onExport: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<"ALL" | MatchStatus | "HIGH">("ALL");
  const summary = result.analysisSummary;
  const tabs: Array<[Tab, string]> = [
    ["overview", "项目概览"],
    ["qualification", "资格审查"],
    ["technical", "技术偏离"],
    ["scoring", "评分分析"],
    ["response", "技术应答"],
    ["library", "我方资料"],
  ];
  const qualification = result.matches.filter(
    (item) => item.category === "资格审查",
  );
  const technical = result.matches.filter((item) =>
    ["技术偏离", "商务要求", "实施交付", "售后服务"].includes(item.category),
  );
  const visibleTechnical = technical.filter((item) =>
    filter === "ALL" || filter === "HIGH"
      ? filter !== "HIGH" || item.risk === "HIGH"
      : item.status === filter,
  );
  const callPath = result.execution.map((item) => item.label).join(" → ");
  const metric = (value: string) => (summary.analyzed ? value : "—");
  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="section-kicker">投标分析总览</p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em] sm:text-3xl">
              {result.document.projectInfo.projectName}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              项目编号：{result.document.projectInfo.projectCode} ·{" "}
              {summary.analyzed ? "已完成分析" : "部分信息待确认"}
            </p>
          </div>
          <div className="rounded-2xl bg-[#edf7d5] px-5 py-3">
            <p className="text-[11px] text-neutral-500">投标建议</p>
            <p className="mt-1 text-sm font-medium">{summary.recommendation}</p>
          </div>
        </div>
        <article className="mt-5 rounded-2xl border border-[#dcecb9] bg-[#f7ffe8] p-4">
          <p className="text-sm font-medium">
            {result.finalAnswerStatus === "failed"
              ? "AI综合结论生成失败"
              : "AI 分析结论"}
          </p>
          <div className="mt-2 text-xs leading-6 text-neutral-700"><MarkdownText value={result.finalAnswer} /></div>
        </article>
        <p className="mt-4 text-xs text-neutral-500">
          本次调用：{callPath || "仅完成文件解析"}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Metric
            label="应标准备度"
            value={metric(`${summary.readinessScore}%`)}
            hint="仅用于项目材料准备度参考，不代表最终中标概率。"
          />
          <Metric
            label="企业资料覆盖率"
            value={metric(`${summary.evidenceCoverage}%`)}
            hint="已有企业证据要求数 / 需要企业证明的要求数。"
          />
          <Metric label="符合" value={metric(`${summary.passCount} 项`)} />
          <Metric
            label="待确认"
            value={metric(`${summary.pendingCount} 项`)}
          />
          <Metric label="资料缺失" value={metric(`${summary.missingEvidenceCount} 项`)} />
          <Metric label="明确不符合" value={metric(`${summary.failCount} 项`)} />
          <Metric
            label="高风险"
            value={metric(`${summary.highRiskCount} 项`)}
          />
        </div>
        {summary.analyzed && (
          <p className="mt-4 text-xs leading-6 text-neutral-500">
            {summary.readinessFormula}
          </p>
        )}
        {analysisStale && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">
            检测到新增项目材料，当前分析结果可能已过期。请点击“重新分析”刷新判断、风险与建议。
          </p>
        )}
      </section>
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-black/5 bg-white p-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium ${tab === id ? "bg-black text-white" : "text-neutral-500 hover:bg-neutral-100"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <Overview result={result} reviewedCount={reviewedIds.length} />
      )}
      {tab === "qualification" && (
        <RequirementList
          title="资格审查"
          description="仅展示供应商资格、企业资质、人员与业绩要求。"
          matches={qualification}
          reviewedIds={reviewedIds}
          onToggleReview={onToggleReview}
        />
      )}
      {tab === "technical" && (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">技术偏离</p>
                <p className="mt-1 text-xs text-neutral-500">
                  技术、商务、交付与售后要求：{technical.length} 项。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "PASS", "PENDING", "MISSING_EVIDENCE", "FAIL", "HIGH"] as const).map(
                  (item) => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-full px-3 py-1.5 text-xs ${filter === item ? "bg-black text-white" : "bg-[#f7f8f9] text-neutral-600"}`}
                    >
                      {item === "ALL"
                        ? "全部"
                        : item === "HIGH"
                          ? "高风险"
                          : statusLabel[item]}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
          <RequirementList
            title="逐条技术偏离"
            description="无企业证据的硬件规格将显示为待确认，不会自动承诺符合。"
            matches={visibleTechnical}
            reviewedIds={reviewedIds}
            onToggleReview={onToggleReview}
          />
        </section>
      )}
      {tab === "scoring" && <ScoringView result={result} />}
      {tab === "response" && <ResponseView result={result} />}
      {tab === "library" && <LibraryView />}
      <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <p>{result.notice}</p>
        <button
          onClick={onExport}
          className="shrink-0 rounded-full border border-amber-300 px-4 py-2 text-xs font-medium"
        >
          <Download className="mr-1 inline" size={14} />
          导出分析建议
        </button>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div title={hint} className="rounded-2xl bg-[#f7f8f9] p-3">
      <p className="text-[11px] text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}
function TraceDrawer({
  result,
  open,
  onClose,
}: {
  result: TenderAgentResult;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/20"
      role="dialog"
      aria-modal="true"
      aria-label="Agent 执行轨迹"
    >
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between border-b border-black/5 pb-4">
          <div>
            <p className="text-lg font-medium">Agent 执行轨迹</p>
            <p className="mt-1 text-xs text-neutral-500">
              仅展示本次实际 execution。
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs"
          >
            关闭
          </button>
        </div>
        <div className="mt-5 flex-1 space-y-3 overflow-y-auto">
          {result.execution.map((item, index) => (
            <details
              key={`${item.id}-${index}`}
              open
              className="rounded-2xl border border-black/5 bg-[#f7f8f9] p-4"
            >
              <summary className="cursor-pointer text-sm font-medium">
                {item.label} ·{" "}
                {item.status === "completed"
                  ? "完成"
                  : item.status === "skipped"
                    ? "已跳过"
                  : item.status === "not_configured"
                    ? "未配置"
                    : "失败"}
              </summary>
              <dl className="mt-3 grid gap-2 text-xs leading-5 text-neutral-600">
                <div>
                  <dt className="text-neutral-400">决策方式</dt>
                  <dd>{item.trace.decisionSource === "llm" ? "模型自主决策" : item.trace.decisionSource === "fallback" ? "规则降级" : "规则决策"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">调用原因</dt>
                  <dd>{item.reason}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">输入摘要</dt>
                  <dd>{item.inputSummary}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Observation</dt>
                  <dd>{item.trace.observation}</dd>
                </div>
                <div>
                  <dt className="text-neutral-400">Provider / 时长 / 来源</dt>
                  <dd>
                    {item.trace.provider ?? "—"} · {item.durationMs} ms ·{" "}
                    {item.trace.sourceCount} 条
                  </dd>
                </div>
                {item.trace.retrievalMethod && (
                  <div>
                    <dt className="text-neutral-400">检索方式</dt>
                    <dd>{item.trace.retrievalMethod}</dd>
                  </div>
                )}
                {item.trace.error && (
                  <div>
                    <dt className="text-neutral-400">错误</dt>
                    <dd>{item.trace.error}</dd>
                  </div>
                )}
                {item.trace.fallback && (
                  <div>
                    <dt className="text-neutral-400">降级说明</dt>
                    <dd>{item.trace.fallback}</dd>
                  </div>
                )}
              </dl>
            </details>
          ))}
          {!result.execution.length && (
            <p className="text-sm text-neutral-500">尚无执行记录。</p>
          )}
        </div>
      </aside>
    </div>
  );
}
function Overview({
  result,
  reviewedCount,
}: {
  result: TenderAgentResult;
  reviewedCount: number;
}) {
  const info = result.document.projectInfo;
  const materialGaps = result.matches.filter(
    (item) => item.status === "MISSING_EVIDENCE" || (item.status === "PENDING" && item.mandatory),
  );
  const fields: Array<[string, string, TenderSource | undefined]> = [
    ["采购人", info.purchaser, info.evidence?.purchaser],
    ["预算 / 限价", info.maxPrice !== "待确认" ? info.maxPrice : info.budget, info.evidence?.maxPrice ?? info.evidence?.budget],
    ["投标截止", info.deadline, info.evidence?.deadline],
    ["建设周期", info.deliveryPeriod, info.evidence?.deliveryPeriod],
    ["采购方式", info.procurementMethod, undefined],
    ["交付地点", info.location, undefined],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
        <p className="text-sm font-medium">项目基本信息</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value, source]) => (
            <div key={label} className="rounded-2xl bg-[#f7f8f9] p-3">
              <p className="text-[11px] text-neutral-400">{label}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-700">
                {value === "资料未提供" || value === "待确认"
                  ? "未提取到"
                  : value}
              </p>
              {source && <Evidence sources={[source]} />}
            </div>
          ))}
        </div>
        {info.targetSummary !== "资料未提供" &&
          info.targetSummary !== "待确认" && (
            <p className="mt-4 text-xs leading-6 text-neutral-500">
              采购标的简述：{info.targetSummary}
            </p>
          )}
      </section>
      <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">TOP 风险</p>
          <span className="text-xs text-neutral-400">
            待人工复核 {reviewedCount} 项
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {result.risks.slice(0, 5).map((item) => (
            <div
              key={item.relatedRequirementIds[0]}
              className="rounded-2xl bg-[#f7f8f9] p-3"
            >
              <RiskBadge risk={item.level} />
              <p className="mt-2 text-xs leading-5 text-neutral-700">
                {item.description}
              </p>
            </div>
          ))}
          {!result.risks.length && (
            <p className="text-sm text-neutral-500">
              未发现需要升级的风险项；仍需人工复核。
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-black/5 bg-white p-4 lg:col-span-2">
        <p className="text-sm font-medium">Agent 执行轨迹</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          {result.planner.mode === "deepseek-tool-calling"
            ? "DeepSeek 根据每步 observation 选择下一工具。"
            : "本次包含规则降级步骤；每步均展示实际决策方式与失败原因。"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {result.execution.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flex items-center gap-2"
            >
              <span className="rounded-full bg-[#f7f8f9] px-3 py-1.5 text-xs text-neutral-700">
                {item.label}
                {item.status === "not_configured" ? "（未配置）" : item.status === "skipped" ? "（已跳过）" : ""}
              </span>
              {index < result.execution.length - 1 && (
                <span className="text-neutral-300">→</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          {result.agentConclusion}
        </p>
      </section>
      <section className="rounded-2xl border border-black/5 bg-white p-4 lg:col-span-2">
        <p className="text-sm font-medium">建议补充材料</p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">仅汇总当前要求中资料缺失或关键待确认事项，不会虚构材料。</p>
        {materialGaps.length ? (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-6 text-neutral-700">
            {materialGaps.map((item) => <li key={item.requirementId}>{item.requirement}（影响：{item.requirementId}）</li>)}
          </ol>
        ) : <p className="mt-3 text-xs text-neutral-500">当前未发现需要补充的关键材料；仍请复核原件有效性。</p>}
      </section>
      <details className="rounded-2xl border border-black/5 bg-white p-4 lg:col-span-2">
        <summary className="cursor-pointer text-sm font-medium">
          查看调用原因、Observation 与未调用工具
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {result.execution.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="rounded-xl bg-[#f7f8f9] p-3"
            >
              <p className="text-xs font-medium">{item.label}</p>
              <p className="mt-2 text-[11px] text-neutral-400">调用原因</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                {item.reason}
              </p>
              <p className="mt-2 text-[11px] text-neutral-400">Observation</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                {item.trace.observation}
              </p>
              <p className="mt-2 text-[11px] text-neutral-400">决策方式</p>
              <p className="mt-1 text-xs leading-5 text-neutral-600">
                {item.trace.decisionSource === "llm" ? "模型自主决策" : item.trace.decisionSource === "fallback" ? "规则降级" : "规则决策"}
                {item.trace.fallback ? ` · ${item.trace.fallback}` : ""}
                {item.trace.error ? ` · 失败原因：${item.trace.error}` : ""}
              </p>
              <p className="mt-2 text-[11px] text-neutral-400">
                来源：{item.trace.sourceCount} · {item.durationMs} ms
                {item.trace.retrievalMethod
                  ? ` · ${item.trace.retrievalMethod}`
                  : ""}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-[#f7f8f9] p-3">
          <p className="text-xs font-medium">本次未调用</p>
          <p className="mt-2 text-xs leading-6 text-neutral-500">
            {result.toolCoverage
              .filter((item) => item.status === "not_called")
              .map((item) => `${item.tool}：${item.reason}`)
              .join("；") || "无"}
          </p>
        </div>
        <div className="mt-4 rounded-xl bg-[#f7f8f9] p-3">
          <p className="text-xs font-medium">外部核验</p>
          <p className="mt-1 text-xs text-neutral-500">
            {result.externalVerification.status === "NOT_CONFIGURED"
              ? "外部核验未启用"
              : result.externalVerification.status === "NOT_EXECUTED"
                ? "未执行（外部信息仅作辅助核验，不替代内部原始证据）"
                : result.externalVerification.status}
          </p>
          {result.externalVerification.results.map((item) => (
            <a
              key={item.url}
              className="mt-2 block text-xs text-neutral-700 underline"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              {item.title} · {item.domain}
            </a>
          ))}
        </div>
        {result.debug && (
          <details className="mt-4 rounded-xl border border-dashed border-black/10 p-3">
            <summary className="cursor-pointer text-xs font-medium">
              Agent Debug（仅开发环境）
            </summary>
            <p className="mt-2 text-xs leading-6 text-neutral-500">
              runId：{result.debug.runId}
              <br />
              模型：{result.debug.model}
              <br />
              Agent 类型：{result.debug.agentType}
              <br />
              决策来源：{result.debug.decisionSource}
              <br />
              工具顺序：{result.debug.actualToolCalls.join(" → ") || "无"}
              <br />
              Provider：DeepSeek {result.debug.providerStatus.deepSeek} / OCR{" "}
              {result.debug.providerStatus.ocr} / Tavily{" "}
              {result.debug.providerStatus.tavily} / Embedding{" "}
              {result.debug.providerStatus.embedding}
            </p>
          </details>
        )}
      </details>
    </div>
  );
}
function AgentCapabilities() {
  const [capabilities, setCapabilities] = useState<Record<string, unknown>>();
  useEffect(() => {
    void fetch("/api/tender-agent")
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data: { capabilities?: Record<string, unknown> } | undefined) =>
        setCapabilities(data?.capabilities),
      )
      .catch(() => undefined);
  }, []);
  if (!capabilities) return null;
  return (
    <details className="mt-5 rounded-2xl border border-dashed border-black/10 p-4">
      <summary className="cursor-pointer text-xs font-medium">
        Agent 能力状态（仅开发环境）
      </summary>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[10px] leading-5 text-neutral-500">
        {JSON.stringify(capabilities, null, 2)}
      </pre>
    </details>
  );
}
function RequirementList({
  title,
  description,
  matches,
  reviewedIds,
  onToggleReview,
}: {
  title: string;
  description: string;
  matches: RequirementMatch[];
  reviewedIds: string[];
  onToggleReview: (id: string) => void;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-neutral-500">{description}</p>
      </div>
      <div className="mt-5 space-y-3">
        {matches.map((match) => (
          <article
            key={match.requirementId}
            className="rounded-2xl border border-black/5 bg-[#f7f8f9] p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] text-neutral-400">
                  {match.requirementId} · {match.category}
                </p>
                <p className="mt-1 text-sm leading-6 font-medium">
                  {match.requirement}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <StatusBadge status={match.status} />
                <RiskBadge risk={match.risk} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[11px] text-neutral-400">判断依据</p>
                <p className="mt-1 text-xs leading-6 text-neutral-700">
                  {match.reason}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-neutral-400">建议</p>
                <p className="mt-1 text-xs leading-6 text-neutral-700">
                  {match.suggestedAction}
                </p>
              </div>
            </div>
            <Evidence sources={match.evidence} judgment={match.reason} />
            <button
              onClick={() => onToggleReview(match.requirementId)}
              className={`mt-3 rounded-full px-3 py-1.5 text-xs font-medium ${reviewedIds.includes(match.requirementId) ? "bg-black text-white" : "border border-black/10 text-neutral-600"}`}
            >
              <ShieldCheck className="mr-1 inline" size={13} />
              {reviewedIds.includes(match.requirementId)
                ? "待人工复核"
                : "加入人工复核"}
            </button>
          </article>
        ))}
        {!matches.length && (
          <p className="py-8 text-center text-sm text-neutral-400">
            当前分类未识别到对应要求。
          </p>
        )}
      </div>
    </section>
  );
}
function ScoringView({ result }: { result: TenderAgentResult }) {
  const emptyMessage =
    result.scoringStatus === "SCORING_SUSPECTED"
      ? "疑似存在评分标准，但当前解析失败；请人工核对原始评分表。"
      : "本文件未提供明确评分标准，因此不进行评分预测。";
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
      <p className="text-sm font-medium">评分分析</p>
      <p className="mt-1 text-xs leading-6 text-neutral-500">
        AI 辅助估算，仅供投标准备参考，最终以评标委员会结果为准。
      </p>
      <div className="mt-5 space-y-3">
        {result.scoringAnalysis.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl bg-[#f7f8f9] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.item}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  满分：{item.maxScore} · 预计得分：{item.estimatedScore}
                </p>
              </div>
              <RiskBadge risk={item.risk} />
            </div>
            <p className="mt-3 text-xs leading-6 text-neutral-600">
              得分规则：{item.scoringRules.join("；")}
            </p>
            <p className="mt-1 text-xs leading-6 text-neutral-600">
              判断依据：{item.reason}
            </p>
            <p className="mt-1 text-xs leading-6 text-neutral-600">
              置信度：{item.confidence === "high" ? "高" : item.confidence === "medium" ? "中" : "低"}
              {item.manualReviewRequired ? " · 需人工复核" : ""}
            </p>
            <Evidence sources={[...item.bidEvidence, ...item.companyEvidence]} judgment={item.reason} />
          </article>
        ))}
        {!result.scoringAnalysis.length && (
          <p className="py-8 text-center text-sm text-neutral-400">
            {emptyMessage}
          </p>
        )}
      </div>
    </section>
  );
}
function ResponseView({ result }: { result: TenderAgentResult }) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex gap-2">
        <FileText size={16} />
        <div>
          <p className="text-sm font-medium">AI 技术应答草稿</p>
          <p className="mt-1 text-xs leading-6 text-neutral-500">
            仅基于本次招标要求和已检索企业证据生成；正式投标前需人工复核。
          </p>
        </div>
      </div>
      <article className="mt-5 rounded-2xl border border-[#dcecb9] bg-[#f7ffe8] p-4">
        <p className="text-xs font-medium">DeepSeek 最终结论</p>
        <div className="mt-2 text-xs leading-6 text-neutral-800"><MarkdownText value={result.finalAnswer} /></div>
      </article>
      {result.evidenceConflicts.length > 0 && (
        <article className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-900">发现证据冲突</p>
          {result.evidenceConflicts.map((item) => (
            <p
              key={item.requirementId}
              className="mt-2 text-xs leading-6 text-amber-900"
            >
              {item.requirement}：{item.judgment}
            </p>
          ))}
        </article>
      )}
      <div className="mt-3 space-y-3">
        {result.solution.sections.map((item) => (
          <article key={item.title} className="rounded-2xl bg-[#f7f8f9] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-2 text-xs leading-6 text-neutral-600">
                  甲方要求：{item.tenderRequirement}
                </p>
              </div>
              <StatusBadge status={item.responseStatus} />
            </div>
            <p className="mt-3 text-xs leading-6 text-neutral-800">
              我方响应：{item.responseSuggestion}
            </p>
            {item.capabilities.length > 0 && (
              <p className="mt-3 text-xs text-neutral-500">
                能力引用：{item.capabilities.join("；")}
              </p>
            )}
            {item.cases.length > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                案例引用：{item.cases.join("；")}
              </p>
            )}
            <Evidence sources={item.sources} />
          </article>
        ))}
        {!result.solution.sections.length && (
          <p className="py-8 text-center text-sm text-neutral-400">
            当前未识别到可生成应答的技术或交付要求。
          </p>
        )}
      </div>
    </section>
  );
}
function LibraryView() {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
      <p className="text-sm font-medium">我方资料库</p>
      <p className="mt-1 text-xs text-neutral-500">
        {companyLibraryOverview.company} · {companyLibraryOverview.label}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companyLibraryOverview.sections.map(([name, count]) => (
          <div key={name} className="rounded-2xl bg-[#f7f8f9] p-4">
            <p className="text-sm font-medium">{name}</p>
            <p className="mt-2 text-2xl font-medium">{count}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-neutral-400">
        {companyLibraryOverview.notice}
      </p>
      <TenderCompanyLibraryManager />
    </section>
  );
}
function PortfolioNarrative() {
  return (
    <section className="mt-16">
      <p className="section-kicker">项目说明与复盘</p>
      <h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">
        从业务问题到可审计的 Agent 闭环
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-500">
        本 POC
        将招标文本、企业证据、规则判断、风险暴露与人工确认组织为可追溯流程；不替代最终投标决策。
      </p>
      <AgentCapabilities />
    </section>
  );
}
