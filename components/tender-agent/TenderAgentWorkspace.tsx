"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FileSearch,
  FileText,
  History,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Workflow,
} from "lucide-react";
import { TenderFileDropzone } from "@/components/tender-agent/TenderFileDropzone";
import { TenderCompanyLibraryManager } from "@/components/tender-agent/TenderCompanyLibraryManager";
import { companyLibraryOverview, tenderKnowledge } from "@/data/tender/knowledge";
import {
  deleteTenderProjectSession,
  getActiveTenderProjectId,
  getTenderProjectSession,
  listTenderProjectSessions,
  saveTenderProjectSession,
  setActiveTenderProjectId,
  type ProjectConversationMessage,
  type ProjectSessionStatus,
  type TenderProjectSession,
} from "@/lib/tender-agent/project-history";
import type {
  CompanyWorkspaceMode,
  CompanyDocument,
  KnowledgeRecord,
  MatchStatus,
  ParsedBidDocument,
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
  | "strategy"
  | "response"
  | "library";
type ConversationMessage = ProjectConversationMessage;
const createAnalysisSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tender-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const createConversationId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const pendingValue = (value?: string) =>
  value && value !== "待确认" && value !== "资料未提供" ? value : "待确认";
const hasProjectMetadata = (projectNumber?: string, purchaser?: string) =>
  Boolean(projectNumber?.trim() || purchaser?.trim());
const cleanProjectNameFallback = (value?: string) =>
  value?.trim().replace(/\.[^./\\]+$/u, "") || "未命名招标项目";
function projectDetails(
  result?: TenderAgentResult,
  files: ParsedBidDocument[] = [],
  fallbackProjectName?: string,
) {
  const info = result?.document.projectInfo;
  return {
    projectName: pendingValue(info?.projectName) !== "待确认"
      ? pendingValue(info?.projectName)
      : cleanProjectNameFallback(files[0]?.fileName || fallbackProjectName),
    projectNumber: pendingValue(info?.projectCode),
    purchaser: pendingValue(info?.purchaser),
  };
}
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
  const [workspaceDocuments, setWorkspaceDocuments] = useState<CompanyDocument[]>([]);
  const [sourceMismatch, setSourceMismatch] = useState(false);
  const [task, setTask] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [storedFiles, setStoredFiles] = useState<ParsedBidDocument[]>([]);
  const [traceOpen, setTraceOpen] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [demoLibraryOpen, setDemoLibraryOpen] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [analysisStale, setAnalysisStale] = useState(false);
  const [askingAgent, setAskingAgent] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [showLatestMessage, setShowLatestMessage] = useState(false);
  const [analysisSessionId, setAnalysisSessionId] = useState(createAnalysisSessionId);
  const [sessionCreatedAt, setSessionCreatedAt] = useState(() => new Date().toISOString());
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyProjects, setHistoryProjects] = useState<ReturnType<typeof listTenderProjectSessions>>([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const leftPanelRef = useRef<HTMLElement>(null);
  const agentChatRef = useRef<HTMLDivElement>(null);
  const agentInputRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const latestUserRef = useRef<HTMLDivElement>(null);
  const latestAssistantRef = useRef<HTMLDivElement>(null);
  const shouldAutoFollowRef = useRef(true);
  const forceScrollToLatestRef = useRef(false);
  const scrollTargetRef = useRef<"user" | "assistant">("user");
  const handleWorkspaceDocuments = useCallback((documents: CompanyDocument[]) => {
    setWorkspaceDocuments((previous) => {
      const changed = previous.length > 0 && (previous.length !== documents.length || previous.some((item, index) => item.documentId !== documents[index]?.documentId || item.indexed !== documents[index]?.indexed || item.fileName !== documents[index]?.fileName || item.category !== documents[index]?.category || item.textLength !== documents[index]?.textLength || item.tags.join("|") !== documents[index]?.tags.join("|")));
      if (changed && result?.companyMode === "workspace") setSourceMismatch(true);
      return documents;
    });
  }, [result]);
  useEffect(() => {
    const activeProjectId = getActiveTenderProjectId();
    const restored = activeProjectId ? getTenderProjectSession(activeProjectId) : undefined;
    const projects = listTenderProjectSessions();
    projects.forEach((project) => {
      const session = getTenderProjectSession(project.projectId);
      if (!session) return;
      const projectName = projectDetails(session.result, session.files, session.projectName).projectName;
      if (session.projectName !== projectName || project.companyMode !== session.companyMode)
        saveTenderProjectSession({ ...session, projectName });
    });
    setHistoryProjects(listTenderProjectSessions());
    if (restored) restoreProjectSession(restored);
    setHistoryHydrated(true);
  // Restore only once after browser storage becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  function jumpToAgentChat() {
    const chatSection = agentChatRef.current;
    const leftPanel = leftPanelRef.current;
    if (chatSection && leftPanel) {
      const targetTop = chatSection.offsetTop - leftPanel.offsetTop - (leftPanel.clientHeight - chatSection.offsetHeight) / 2;
      leftPanel.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    } else {
      chatSection?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    requestAnimationFrame(() => agentInputRef.current?.focus());
  }
  function openRealWorkspace() {
    setCompanyMode("workspace");
    if (result && result.companyMode !== "workspace") setSourceMismatch(true);
    setWorkspaceOpen(true);
  }
  function manageCurrentCompanySource() {
    if (companyMode === "demo") setDemoLibraryOpen(true);
    else setWorkspaceOpen(true);
  }
  function selectCompanyMode(mode: CompanyWorkspaceMode) {
    if (mode === "workspace") {
      openRealWorkspace();
      return;
    }
    if (result && result.companyMode !== mode) setSourceMismatch(true);
    setCompanyMode(mode);
  }
  useEffect(() => {
    if (!historyHydrated || (!result && !storedFiles.length && !conversation.length)) return;
    const previous = getTenderProjectSession(analysisSessionId);
    const now = new Date().toISOString();
    const details = projectDetails(result, storedFiles, previous?.projectName);
    const status: ProjectSessionStatus = error
      ? "failed"
      : running || askingAgent
      ? "analyzing"
      : result
        ? analysisStale || sourceMismatch ? "needs_review" : "completed"
        : "draft";
    saveTenderProjectSession({
      projectId: analysisSessionId,
      ...details,
      files: result?.files?.length ? result.files : storedFiles,
      result,
      conversations: conversation,
      companyMode,
      status,
      createdAt: previous?.createdAt ?? sessionCreatedAt,
      updatedAt: now,
      lastAnalyzedAt: result ? lastAnalyzedAt ?? now : undefined,
    });
    setActiveTenderProjectId(analysisSessionId);
    setHistoryProjects(listTenderProjectSessions());
  }, [analysisSessionId, analysisStale, askingAgent, companyMode, conversation, error, historyHydrated, lastAnalyzedAt, result, running, sessionCreatedAt, sourceMismatch, storedFiles]);
  function restoreProjectSession(session: TenderProjectSession) {
    setAnalysisSessionId(session.projectId);
    setSessionCreatedAt(session.createdAt);
    setLastAnalyzedAt(session.lastAnalyzedAt);
    setResult(session.result);
    setConversation(session.conversations);
    setStoredFiles(session.files);
    setUploadedFiles([]);
    setCompanyMode(session.companyMode);
    setSourceMismatch(Boolean(session.result && session.result.companyMode !== session.companyMode));
    setTask("");
    setAnalysisStale(session.status === "needs_review");
    setReviewedIds([]);
    setError("");
    setShowLatestMessage(false);
    setActiveTenderProjectId(session.projectId);
  }
  function beginNewSession(createProject = false) {
    const nextId = createAnalysisSessionId();
    const now = new Date().toISOString();
    setAnalysisSessionId(nextId);
    setSessionCreatedAt(now);
    setLastAnalyzedAt(undefined);
    setResult(undefined);
    setConversation([]);
    setStoredFiles([]);
    setUploadedFiles([]);
    setTask("");
    setAnalysisStale(false);
    setSourceMismatch(false);
    setReviewedIds([]);
    setShowLatestMessage(false);
    setActiveTenderProjectId(nextId);
    if (createProject && historyHydrated) {
      saveTenderProjectSession({
        projectId: nextId,
        projectName: "未命名招标项目",
        projectNumber: "待确认",
        purchaser: "待确认",
        files: [],
        conversations: [],
        companyMode,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      setHistoryProjects(listTenderProjectSessions());
    }
  }
  async function startAnalysis() {
    if ((!uploadedFiles.length && !storedFiles.length) || running) return;
    setRunning(true);
    setError("");
    setReviewedIds([]);
    try {
      const response = uploadedFiles.length
        ? await (() => {
            const body = new FormData();
            uploadedFiles.forEach((file) => body.append("file", file));
            body.append("companyMode", companyMode);
            body.append("action", "analyze");
            return fetch("/api/tender-agent", { method: "POST", body });
          })()
        : await fetch("/api/tender-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reanalyze",
              companyMode,
              files: storedFiles,
            }),
          });
      const data = (await response.json()) as {
        result?: TenderAgentResult;
        message?: string;
      };
      if (!response.ok || !data.result)
        throw new Error(data.message || "分析未完成。");
      setResult(data.result);
      setStoredFiles(data.result.files ?? storedFiles);
      setLastAnalyzedAt(new Date().toISOString());
      setAnalysisStale(false);
      setSourceMismatch(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析未完成。");
    } finally {
      setRunning(false);
    }
  }
  async function askAgent() {
    if (sourceMismatch) {
      setError("企业资料源已变化，请先重新分析企业能力匹配后再继续询问。");
      return;
    }
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
      {
        id: createConversationId(),
        role: "user",
        content: enteredQuestion,
        createdAt: new Date().toISOString(),
      },
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
        {
          id: createConversationId(),
          role: "assistant",
          content: data.answer!,
          sources: data.webEvidence,
          createdAt: new Date().toISOString(),
        },
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
  function openProjectHistory() {
    setHistoryProjects(listTenderProjectSessions());
    setHistoryOpen(true);
  }
  function deleteProject(projectId: string, projectName: string) {
    if (!window.confirm(`确定删除“${projectName}”的本地项目历史吗？此操作不可恢复。`)) return;
    deleteTenderProjectSession(projectId);
    setHistoryProjects(listTenderProjectSessions());
    if (projectId === analysisSessionId) beginNewSession();
  }
  const filteredHistoryProjects = historyProjects.filter((project) => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return true;
    return [project.projectName, project.projectNumber, project.purchaser]
      .some((value) => value.toLowerCase().includes(query));
  });
  const currentAnalysisStale = analysisStale || sourceMismatch;
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
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTraceOpen(true)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium">查看 Agent 轨迹</button>
                <button onClick={() => setRubricOpen(true)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium">查看评估结果</button>
              </div>
            )}
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-neutral-500">
            从招标文件出发，完成需求分类、企业证据核验、风险识别与技术应答草稿生成。
          </p>
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-neutral-700">当前资料来源</p>
            <div className="inline-flex rounded-full border border-black/10 bg-white p-1">
            <button
              onClick={() => selectCompanyMode("demo")}
              className={`rounded-full px-3 py-1.5 text-xs transition ${companyMode === "demo" ? "bg-black text-white" : "text-neutral-600"}`}
            >
              演示资料（内置样例）
            </button>
            <button
              onClick={openRealWorkspace}
              className={`rounded-full px-3 py-1.5 text-xs transition ${companyMode === "workspace" ? "bg-black text-white" : "text-neutral-600"}`}
            >
              真实企业资料
            </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            {companyMode === "demo"
              ? "系统内置一套示例企业资料，用于体验完整招投标 Agent 流程。"
              : workspaceDocuments.length ? `真实企业资料 · ${workspaceDocuments.length} 个文件 · 已索引 ${workspaceDocuments.filter((item) => item.parseStatus === "PARSED" && item.indexed).length} 个` : "当前已切换至真实企业资料，但尚未导入文件；上传并完成索引后可用于企业能力判断。"}
          </p>
          {companyMode === "demo" && <p className="mt-2 text-xs text-neutral-500">资料概览：企业基本信息 · 企业资质 · 技术能力 · 历史案例 · 项目交付能力</p>}
          <CompanySourceSummary companyMode={companyMode} workspaceDocuments={workspaceDocuments} onManage={manageCurrentCompanySource} />
        </div>
        <div className="mt-10 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside ref={leftPanelRef} className="h-fit rounded-[28px] border border-black/5 bg-white p-5 shadow-soft xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSearch size={16} />
                <h2 className="font-medium">招标材料输入</h2>
              </div>
              <button
                type="button"
                onClick={openProjectHistory}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700"
              >
                <History size={13} /> 历史项目
              </button>
            </div>
            <p className="mt-3 text-xs leading-6 text-neutral-500">
              可一次或分批追加项目资料。文件解析完成后，再手动启动完整投标分析。
            </p>
            <TenderFileDropzone
              key={analysisSessionId}
              companyMode={companyMode}
              onBusy={setRunning}
              restoredFiles={storedFiles}
              onFilesReady={(files, parsedFiles) => {
                setError("");
                setReviewedIds([]);
                const removedExistingFile = uploadedFiles.some((file) => !files.some((next) => next.name === file.name && next.size === file.size));
                const onlyAppended = uploadedFiles.length > 0 && uploadedFiles.every((file) => files.some((next) => next.name === file.name && next.size === file.size));
                if (removedExistingFile || (result && !onlyAppended)) beginNewSession();
                else if (result) setAnalysisStale(true);
                setUploadedFiles(files);
                setStoredFiles(parsedFiles);
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
                disabled={running || (!uploadedFiles.length && !storedFiles.length)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#c7ff4d] px-4 py-3 text-sm font-medium disabled:opacity-50"
              >
                <Sparkles size={16} />
                {running ? "分析中…" : currentAnalysisStale ? companyMode === "workspace" ? "使用真实企业资料重新分析" : "重新分析" : "开始投标分析"}
              </button>
            </div>
            <div className="mt-6 border-t border-black/5 pt-5">
                <button
                  type="button"
                  onClick={jumpToAgentChat}
                  className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                >
                  继续询问 Agent <ChevronDown size={15} aria-hidden="true" />
                </button>
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
                <div ref={agentChatRef} id="agent-chat-section" className="mt-3 shrink-0">
                  <textarea
                    ref={agentInputRef}
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                    placeholder="询问本项目，例如：我们公司能投吗？最容易废标的三项是什么？"
                    className="min-h-24 w-full rounded-xl border border-black/10 bg-[#f7f8f9] p-3 text-xs leading-5 outline-none focus:border-black/30"
                  />
                  <button
                    onClick={askAgent}
                    type="button"
                    disabled={running || askingAgent || !result || !task.trim()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-black/10 px-4 py-3 text-sm font-medium disabled:opacity-50"
                  >
                    <Sparkles size={16} />
                    {askingAgent ? "Agent 正在分析…" : "发送"}
                  </button>
                </div>
            </div>
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
                analysisStale={currentAnalysisStale}
                sourceMismatch={sourceMismatch}
                companyMode={companyMode}
                workspaceDocuments={workspaceDocuments}
                onOpenRealWorkspace={openRealWorkspace}
                onManageCompanySource={manageCurrentCompanySource}
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
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="历史项目">
          <div className="ml-auto flex h-full w-full max-w-md flex-col rounded-[28px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-medium">历史项目</p>
                <p className="mt-1 text-xs text-neutral-500">仅保存在当前浏览器，可随时恢复继续分析。</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="关闭历史项目" className="rounded-full p-2 text-neutral-500 hover:bg-black/5">
                <X size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => { beginNewSession(true); setHistoryOpen(false); }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#c7ff4d] px-4 py-3 text-sm font-medium"
            >
              <Plus size={16} /> 新建项目
            </button>
            <label className="mt-4 flex items-center gap-2 rounded-xl border border-black/10 bg-[#f7f8f9] px-3 py-2 text-neutral-500">
              <Search size={15} />
              <input
                value={historyQuery}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder="搜索项目名称、编号或采购人"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-400"
              />
            </label>
            <div className="tender-chat-scroll mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {filteredHistoryProjects.map((project) => (
                <article key={project.projectId} className="relative rounded-2xl border border-black/5 bg-[#f7f8f9] p-4 text-xs">
                    <button
                      type="button"
                      onClick={() => { const session = getTenderProjectSession(project.projectId); if (session) { restoreProjectSession(session); setHistoryOpen(false); } }}
                      aria-label={`打开项目 ${project.projectName}`}
                      className="absolute inset-0 rounded-2xl transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                    />
                  <div className="relative pointer-events-none min-w-0 pr-9">
                    <p className="truncate font-medium text-neutral-900">{project.projectName}</p>
                    {hasProjectMetadata(project.projectNumber, project.purchaser) && (
                      <p className="mt-1 text-neutral-500">
                        项目编号：{pendingValue(project.projectNumber)}
                        {" · "}
                        采购人：{pendingValue(project.purchaser)}
                      </p>
                    )}
                    <p className="mt-2 text-neutral-500">{project.files.length} 个文件 · {project.status === "completed" ? "已完成" : project.status === "needs_review" || project.status === "draft" ? "待补充" : project.status === "analyzing" ? "分析中" : "分析失败"}</p>
                    <p className="mt-1 text-[11px] text-neutral-400">{project.companyMode === "workspace" ? "真实企业资料" : "演示企业资料"}</p>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {project.status === "analyzing" ? "正在分析…" : `最后分析：${project.lastAnalyzedAt ? new Date(project.lastAnalyzedAt).toLocaleString("zh-CN") : "尚未分析"}`}
                    </p>
                  </div>
                    <button
                      type="button"
                      onClick={() => deleteProject(project.projectId, project.projectName)}
                      aria-label={`删除 ${project.projectName}`}
                      className="absolute right-3 top-3 z-10 rounded-full p-2 text-neutral-400 hover:bg-white hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                </article>
              ))}
              {!filteredHistoryProjects.length && (
                <p className="py-10 text-center text-xs text-neutral-400">暂无匹配的项目历史。</p>
              )}
            </div>
          </div>
        </div>
      )}
      {result && (
        <TraceDrawer
          result={result}
          open={traceOpen}
          onClose={() => setTraceOpen(false)}
        />
      )}
      {result && <RubricDrawer result={result} open={rubricOpen} onClose={() => setRubricOpen(false)} />}
      {workspaceOpen && (
        <div className="fixed inset-0 z-[60] bg-black/20 p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="管理企业资料">
          <div className="ml-auto flex h-full w-full max-w-4xl flex-col rounded-[28px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4"><div><p className="text-lg font-medium">管理企业资料</p><p className="mt-1 text-xs text-neutral-500">仅使用本地真实企业资料，不会混入演示资料。</p></div><button type="button" onClick={() => setWorkspaceOpen(false)} className="rounded-full border border-black/10 p-2 text-neutral-600" aria-label="关闭企业资料管理"><X size={16} /></button></div>
            <div className="mt-5 flex-1 overflow-y-auto"><TenderCompanyLibraryManager onDocumentsChange={handleWorkspaceDocuments} /></div>
          </div>
        </div>
      )}
      {demoLibraryOpen && (
        <div className="fixed inset-0 z-[60] bg-black/20 p-4 sm:p-6" role="dialog" aria-modal="true" aria-label="演示企业资料详情">
          <div className="ml-auto flex h-full w-full max-w-4xl flex-col rounded-[28px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-black/5 pb-4"><div><p className="text-lg font-medium">演示企业资料</p><p className="mt-1 text-xs text-neutral-500">内置样例 · Demo Dataset · 仅供体验 Agent 分析流程。</p></div><button type="button" onClick={() => setDemoLibraryOpen(false)} className="rounded-full border border-black/10 p-2 text-neutral-600" aria-label="关闭演示企业资料"><X size={16} /></button></div>
            <DemoLibraryDetails />
          </div>
        </div>
      )}
    </section>
  );
}

function ResultView({
  result,
  analysisStale,
  sourceMismatch,
  companyMode,
  workspaceDocuments,
  onOpenRealWorkspace,
  onManageCompanySource,
  reviewedIds,
  onToggleReview,
  onExport,
}: {
  result: TenderAgentResult;
  analysisStale: boolean;
  sourceMismatch: boolean;
  companyMode: CompanyWorkspaceMode;
  workspaceDocuments: CompanyDocument[];
  onOpenRealWorkspace: () => void;
  onManageCompanySource: () => void;
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
    ["strategy", "售前策略"],
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
          {result.finalAnswerStatus === "failed" && result.finalAnswerError && <p className="mt-2 text-[11px] leading-5 text-amber-800">失败原因：{result.finalAnswerError}</p>}
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
            {sourceMismatch
              ? `当前结果基于${result.companyMode === "workspace" ? "真实企业资料" : "演示企业资料"}，企业资料源已切换；招标文件解析已保留，请重新分析企业能力匹配。`
              : "检测到新增项目材料，当前分析结果可能已过期。请点击“重新分析”刷新判断、风险与建议。"}
            {sourceMismatch && companyMode === "workspace" && <button type="button" onClick={onOpenRealWorkspace} className="ml-2 font-medium underline">补充真实企业资料</button>}
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
      {tab === "strategy" && <PresalesStrategyView result={result} />}
      {tab === "response" && <ResponseView result={result} />}
      {tab === "library" && <LibraryView companyMode={companyMode} workspaceDocuments={workspaceDocuments} onOpenRealWorkspace={onOpenRealWorkspace} onManage={onManageCompanySource} />}
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
function RubricDrawer({ result, open, onClose }: { result: TenderAgentResult; open: boolean; onClose: () => void }) {
  if (!open) return null;
  const evaluation = result.presalesStrategy.evaluation;
  const evidence = result.execution.flatMap((item) => item.sources).slice(0, 6);
  const toolFailures = result.execution.filter((item) => item.status === "failed");
  const rows = [
    ["Evidence Grounding", evaluation.evidenceCoverage >= 80 ? "PASS" : "需复核", `关键结论 Evidence 覆盖率 ${evaluation.evidenceCoverage}%。`],
    ["事实可追溯性", evidence.length > 0 ? "PASS" : "需复核", evidence.length ? `本次执行保留 ${evidence.length} 条可展开的来源。` : "当前没有可展示的来源，结论需人工复核。"],
    ["风险识别完整度", `${Math.min(5, Math.max(1, result.presalesStrategy.riskRadar.risks.length + 2))}/5`, `已识别 ${result.presalesStrategy.riskRadar.risks.length} 项结构化风险；未识别项不会被推断为无风险。`],
    ["缺失信息处理", evaluation.uncertaintyHandling >= 80 ? "PASS" : "需复核", `不确定性处理覆盖率 ${evaluation.uncertaintyHandling}%。`],
    ["不确定性表达", evaluation.uncertaintyHandling >= 80 ? "PASS" : "需复核", "资料不足时使用待确认/资料未提供，而非反向推断不具备。"],
    ["Tool Calling 正确性", toolFailures.length === 0 ? "PASS" : "需复核", toolFailures.length ? `${toolFailures.map((item) => item.label).join("、")} 未成功完成。` : "仅展示本次实际调用与规则跳过，不额外触发工具。"],
    ["幻觉控制", evaluation.unsupportedClaims === 0 ? "PASS" : "需复核", evaluation.unsupportedClaims === 0 ? "未发现无依据的确定性结论。" : `发现 ${evaluation.unsupportedClaims} 项需要补充证据的结论。`],
  ] as const;
  const passed = rows.filter(([, value]) => value === "PASS" || /^\d\/5$/.test(value)).length;
  const reliabilityScore = Math.round((evaluation.evidenceCoverage + evaluation.completeness + evaluation.uncertaintyHandling + (evaluation.unsupportedClaims === 0 ? 100 : 0) + (toolFailures.length ? 50 : 100)) / 5);
  const completion = result.taskCompletion;
  const taskStatus = completion.status === "completed" ? "已完成" : completion.status === "execution_failed" ? "执行失败" : "部分完成";
  return <div className="fixed inset-0 z-[70] bg-black/20" role="dialog" aria-modal="true" aria-label="Agent 轻量评估结果"><aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between border-b border-black/5 pb-4"><div><p className="text-lg font-medium">Agent 轻量评估</p><p className="mt-1 text-xs text-neutral-500">用于本次结果的可追溯性与降级表现验收，不是招标评分标准。</p></div><button type="button" onClick={onClose} className="rounded-full border border-black/10 px-3 py-1.5 text-xs">关闭</button></div><div className="mt-5 flex-1 space-y-3 overflow-y-auto">{rows.map(([label, value, detail]) => <details key={label} className="rounded-2xl border border-black/5 bg-[#f7f8f9] p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium"><span>{label}</span><span className={`rounded-full px-2.5 py-1 text-[11px] ${value === "PASS" || /^\d\/5$/.test(value) ? "bg-[#e7f6cf] text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{value}</span></summary><p className="mt-3 text-xs leading-6 text-neutral-600">{detail}</p>{evidence.length > 0 && <Evidence sources={evidence} />}</details>)}<div className="rounded-2xl bg-[#e7f6cf] p-4"><p className="text-sm font-medium">可信度评分：{reliabilityScore}/100 · {evaluation.overallQuality}</p><p className="mt-1 text-xs leading-6 text-neutral-700">该评分仅评估 Agent 输出的可信度、安全性与证据约束，不代表任务完成程度。通过项 {passed}/{rows.length}。</p></div><div className="rounded-2xl border border-black/5 bg-white p-4"><p className="text-sm font-medium">任务完成度：{completion.score}/100 · {taskStatus}</p><div className="mt-3 space-y-2">{completion.tasks.map((item) => <details key={item.id} className="text-xs text-neutral-600"><summary className="cursor-pointer"><span className="font-medium text-neutral-800">{item.label}</span> · {item.status === "completed" ? "已完成" : item.status === "insufficient_evidence" ? "资料不足" : item.status === "execution_failed" ? "生成失败" : "暂不适用"}</summary><p className="mt-1 leading-5">{item.detail}</p></details>)}</div></div></div></aside></div>;
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
function PresalesStrategyView({ result }: { result: TenderAgentResult }) {
  const [section, setSection] = useState<"radar" | "sprint" | "control" | "competitor">("radar");
  const strategy = result.presalesStrategy;
  const priorityLabel = {
    must_win: "必拿分",
    fight_for: "重点争取",
    low_priority: "谨慎投入",
    difficult: "当前难拿",
  };
  const severityLabel = { critical: "致命风险", high: "高风险", medium: "中风险", low: "低风险" };
  const severityStyle = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-900",
    medium: "bg-amber-100 text-amber-900",
    low: "bg-emerald-100 text-emerald-800",
  };
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">售前策略</p>
          <p className="mt-1 text-xs leading-6 text-neutral-500">策略结论只基于已解析条款、评分规则与企业 Evidence；不推断真实竞品或最终得分。</p>
        </div>
        <div className="rounded-xl bg-[#f7ffe8] px-3 py-2 text-xs text-neutral-700">轻量评估：{strategy.evaluation.overallQuality} 级</div>
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto">
        {(["radar", "sprint", "control", "competitor"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setSection(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${section === id ? "bg-black text-white" : "bg-[#f7f8f9] text-neutral-600"}`}>
            {{ radar: "风险雷达", sprint: "评分冲刺", control: "倾向性分析", competitor: "竞品策略" }[id]}
          </button>
        ))}
      </div>
      {section === "radar" && (
        <div className="mt-5 space-y-3">
          <p className="text-xs text-neutral-500">致命 {strategy.riskRadar.criticalCount} 项 · 高风险 {strategy.riskRadar.highCount} 项 · 中风险 {strategy.riskRadar.mediumCount} 项</p>
          {strategy.riskRadar.risks.map((item, index) => (
            <article key={`${item.title}-${index}`} className="rounded-2xl bg-[#f7f8f9] p-4">
              <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{item.title}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${severityStyle[item.severity]}`}>{severityLabel[item.severity]}</span></div>
              <p className="mt-2 text-xs leading-6 text-neutral-600">{item.reason}</p>
              <p className="mt-1 text-xs leading-6 text-neutral-500">影响：{item.consequence}</p>
              <p className="mt-1 text-xs leading-6 text-neutral-700">建议：{item.recommendation}</p>
              <Evidence sources={item.evidence} judgment={item.clause} />
            </article>
          ))}
          {!strategy.riskRadar.risks.length && <article className="rounded-2xl bg-[#f7f8f9] p-4 text-xs leading-6 text-neutral-600"><p className="font-medium text-neutral-800">当前未形成升级风险清单</p><p className="mt-1">已检查废标风险、资格风险、材料缺口与高风险条款；现有文本未提供足以升级的组合证据。</p><p className="mt-1">建议补充：完整资格要求、否决条款和技术参数原文，再进行人工复核。</p></article>}
        </div>
      )}
      {section === "sprint" && (
        <div className="mt-5 space-y-3">
          <p className="text-xs leading-6 text-neutral-500">{strategy.scoreSprint.summary} {strategy.scoreSprint.actions.length ? <>可确认分：{strategy.scoreSprint.confirmedScore ?? 0} · 可争取分：{strategy.scoreSprint.potentialScore ?? 0} · 可计算总分：{strategy.scoreSprint.totalAvailableScore}</> : <>可确认分：— · 可争取分：— · 可计算总分：— · 暂不可计算</>}</p>
          {strategy.scoreSprint.actions.map((item, index) => (
            <article key={`${item.scoreItem}-${index}`} className="rounded-2xl bg-[#f7f8f9] p-4">
              <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{item.scoreItem}</p><span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-neutral-700">{priorityLabel[item.priority]} · {item.availableScore}</span></div>
              <p className="mt-2 text-xs leading-6 text-neutral-600">缺口：{item.gap}</p><p className="mt-1 text-xs leading-6 text-neutral-700">行动：{item.recommendedAction}</p>
              <Evidence sources={item.evidence} />
            </article>
          ))}
          {!strategy.scoreSprint.actions.length && <article className="rounded-2xl bg-[#f7f8f9] p-4 text-xs leading-6 text-neutral-600"><p className="font-medium text-neutral-800">暂不可计算</p><p className="mt-1">未解析到可用评分项，暂不生成分值预测。</p><p className="mt-1">缺少：评分表 / 分值权重 / 加扣分规则。</p></article>}
        </div>
      )}
      {section === "control" && (
        <div className="mt-5 space-y-3">
          <p className="text-xs leading-6 text-neutral-500">{strategy.controlRiskAnalysis.summary}</p>
          {strategy.controlRiskAnalysis.suspiciousClauses.map((item, index) => (
            <article key={`${item.category}-${index}`} className="rounded-2xl bg-[#f7f8f9] p-4"><p className="text-sm font-medium">{item.category} · {item.riskLevel === "high" ? "高风险" : "中风险"}</p><p className="mt-2 text-xs leading-6 text-neutral-600">{item.reason}</p><p className="mt-1 text-xs leading-6 text-neutral-700">应对：{item.responseStrategy}</p><Evidence sources={item.evidence} judgment={item.clause} /></article>
          ))}
          {!strategy.controlRiskAnalysis.suspiciousClauses.length && <article className="rounded-2xl bg-[#f7f8f9] p-4 text-xs leading-6 text-neutral-600"><p className="font-medium text-neutral-800">未发现可由当前文本直接支持的明显倾向性信号。</p><p className="mt-1">已检查品牌、参数、业绩、地域及技术路线；不能据此判断存在内定或控标。</p><p className="mt-1">建议补充：完整技术参数、品牌限制及业绩门槛原文。</p></article>}
        </div>
      )}
      {section === "competitor" && (
        <div className="mt-5 space-y-3">
          <p className="text-xs leading-6 text-neutral-500">{strategy.competitorAnalysis.summary}</p>
          {strategy.competitorAnalysis.likelyCompetitionAreas.map((item, index) => (
            <article key={`${item.dimension}-${index}`} className="rounded-2xl bg-[#f7f8f9] p-4"><p className="text-sm font-medium">{item.dimension} · {item.scoreWeight}</p><p className="mt-2 text-xs leading-6 text-neutral-600">推演：{item.competitorLikelyStrategy}</p><p className="mt-1 text-xs leading-6 text-neutral-700">我方现状：{item.ourCurrentPosition}</p><Evidence sources={item.evidence} /></article>
          ))}
          {!strategy.competitorAnalysis.likelyCompetitionAreas.length && <article className="rounded-2xl bg-[#f7f8f9] p-4 text-xs leading-6 text-neutral-600"><p className="font-medium text-neutral-800">当前可判断竞争维度：技术参数、企业资质、案例与服务能力。</p><p className="mt-1">无法判断：竞争对手名单、评分权重和公开中标表现；因此未虚构竞品结论。</p><p className="mt-1">建议补充：评分规则、公开中标信息；如需外部最新信息，可在 Agent 对话中明确请求 Web Search 核验。</p></article>}
        </div>
      )}
      <div className="mt-5 grid gap-2 border-t border-black/5 pt-4 text-xs text-neutral-600 sm:grid-cols-4">
        <p>Evidence：{strategy.evaluation.evidenceCoverage}%</p><p>模块完整：{strategy.evaluation.completeness}%</p><p>不确定性：{strategy.evaluation.uncertaintyHandling}%</p><p>无依据结论：{strategy.evaluation.unsupportedClaims} 项</p>
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
      {result.externalVerification.projectConflicts?.length ? (
        <article className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-900">发现外部信息冲突</p>
          {result.externalVerification.projectConflicts.map((item, index) => (
            <div key={`${item.url}-${index}`} className="mt-2 text-xs leading-6 text-amber-900">
              <p>冲突字段：{item.field}</p>
              <p>文件原文：{item.fileValue}（{item.fileSource}）</p>
              <p>联网来源：{item.externalValue}</p>
              <a className="underline" href={item.url} target="_blank" rel="noreferrer">{item.title} · 来源链接</a>
            </div>
          ))}
        </article>
      ) : null}
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
function CompanySourceSummary({
  companyMode,
  workspaceDocuments,
  onManage,
}: {
  companyMode: CompanyWorkspaceMode;
  workspaceDocuments: CompanyDocument[];
  onManage: () => void;
}) {
  const realDocuments = workspaceDocuments.filter((item) => item.parseStatus === "PARSED" && item.indexed);
  const demoEvidenceCount = companyLibraryOverview.sections.reduce((total, [, count]) => total + count, 0);
  return (
    <section className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-xs text-neutral-600">
      <span className="font-medium text-neutral-800">我方资料：</span>{companyMode === "demo" ? <><span className="font-medium text-neutral-800">演示企业资料（内置样例）</span><span>·</span><span>{companyLibraryOverview.sections.length} 类能力 · {demoEvidenceCount} 条 Evidence</span></> : <><span className="font-medium text-neutral-800">真实企业资料</span><span>·</span><span>{workspaceDocuments.length} 个文件 · 已索引 {realDocuments.length} 个</span></>}<button type="button" onClick={onManage} className="ml-auto rounded-full border border-black/10 px-3 py-1.5 font-medium text-neutral-700 hover:border-emerald-800 hover:text-emerald-800">{companyMode === "demo" ? "查看演示企业资料" : "管理企业资料"}</button>
    </section>
  );
}

const demoCategoryByLabel: Record<string, KnowledgeRecord["category"]> = { "公司资料": "company", "企业资质": "qualification", "项目成员": "personnel", "历史案例": "case", "产品能力": "product", "实施交付": "delivery", "售后服务": "after-sales" };
function DemoLibraryDetails() {
  return <div className="mt-5 flex-1 space-y-4 overflow-y-auto"><section className="rounded-2xl bg-[#f7f8f9] p-4"><p className="text-sm font-medium">资料概览</p><p className="mt-1 text-xs leading-6 text-neutral-600">演示企业：{companyLibraryOverview.company} · {companyLibraryOverview.sections.length} 类能力 · {tenderKnowledge.length} 条 Evidence</p><div className="mt-3 flex flex-wrap gap-2">{companyLibraryOverview.sections.map(([label, count]) => <span key={label} className="rounded-full bg-white px-3 py-1.5 text-xs text-neutral-700">{label} · {count}</span>)}</div></section><section><p className="text-sm font-medium">能力分类与 Evidence</p><div className="mt-3 space-y-2">{companyLibraryOverview.sections.map(([label]) => <details key={label} className="rounded-2xl border border-black/5 bg-[#f7f8f9] p-4"><summary className="cursor-pointer text-sm font-medium">{label} · {tenderKnowledge.filter((item) => item.category === demoCategoryByLabel[label]).length} 条 Evidence</summary><div className="mt-3 space-y-2">{tenderKnowledge.filter((item) => item.category === demoCategoryByLabel[label]).map((item) => <article key={item.id} className="rounded-xl bg-white px-3 py-3"><p className="text-xs font-medium text-neutral-800">{item.title}</p><p className="mt-1 text-xs leading-5 text-neutral-600">{item.content}</p><p className="mt-1 text-[11px] text-neutral-400">来源：{item.sourceFile}</p></article>)}</div></details>)}</div></section></div>;
}
function LibraryView({ companyMode, workspaceDocuments, onOpenRealWorkspace, onManage }: {
  companyMode: CompanyWorkspaceMode;
  workspaceDocuments: CompanyDocument[];
  onOpenRealWorkspace: () => void;
  onManage: () => void;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-5 shadow-soft sm:p-6">
      <p className="text-sm font-medium">我方资料库</p>
      <CompanySourceSummary companyMode={companyMode} workspaceDocuments={workspaceDocuments} onManage={onManage} />
      {companyMode === "demo" && <p className="mt-5 text-xs text-neutral-400">{companyLibraryOverview.notice}</p>}
      {companyMode === "workspace" && <button type="button" onClick={onOpenRealWorkspace} className="mt-5 text-xs font-medium text-neutral-800 underline">管理真实企业资料</button>}
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
