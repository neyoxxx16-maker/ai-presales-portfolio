import type {
  CompanyWorkspaceMode,
  ParsedBidDocument,
  TenderAgentResult,
  TenderSource,
} from "@/types/tender-agent";

const INDEX_KEY = "tender-agent-project-index";
const ACTIVE_KEY = "tender-agent-active-project";
const projectKey = (projectId: string) => `tender-agent-project:${projectId}`;

export type ProjectConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: TenderSource[];
};
export type ProjectSessionStatus =
  | "draft"
  | "analyzing"
  | "completed"
  | "needs_review"
  | "failed";
export type TenderProjectSession = {
  projectId: string;
  projectName: string;
  projectNumber: string;
  purchaser: string;
  files: ParsedBidDocument[];
  result?: TenderAgentResult;
  conversations: ProjectConversationMessage[];
  companyMode: CompanyWorkspaceMode;
  status: ProjectSessionStatus;
  createdAt: string;
  updatedAt: string;
  lastAnalyzedAt?: string;
};
type TenderProjectIndexItem = Pick<
  TenderProjectSession,
  | "projectId"
  | "projectName"
  | "projectNumber"
  | "purchaser"
  | "companyMode"
  | "files"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "lastAnalyzedAt"
>;

function storage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
function parse<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}
function toIndexItem(session: TenderProjectSession): TenderProjectIndexItem {
  const {
    projectId,
    projectName,
    projectNumber,
    purchaser,
    companyMode,
    files,
    status,
    createdAt,
    updatedAt,
    lastAnalyzedAt,
  } = session;
  return {
    projectId,
    projectName,
    projectNumber,
    purchaser,
    companyMode,
    files,
    status,
    createdAt,
    updatedAt,
    lastAnalyzedAt,
  };
}

/** Project payloads are stored by id so one tender never overwrites another. */
export function listTenderProjectSessions(): TenderProjectIndexItem[] {
  const currentStorage = storage();
  const index = parse<TenderProjectIndexItem[]>(currentStorage?.getItem(INDEX_KEY) ?? null) ?? [];
  return index.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
export function getTenderProjectSession(projectId: string): TenderProjectSession | undefined {
  const currentStorage = storage();
  return parse<TenderProjectSession>(currentStorage?.getItem(projectKey(projectId)) ?? null);
}
export function saveTenderProjectSession(session: TenderProjectSession): boolean {
  const currentStorage = storage();
  if (!currentStorage) return false;
  try {
    currentStorage.setItem(projectKey(session.projectId), JSON.stringify(session));
    const nextIndex = [
      toIndexItem(session),
      ...listTenderProjectSessions().filter((item) => item.projectId !== session.projectId),
    ];
    currentStorage.setItem(INDEX_KEY, JSON.stringify(nextIndex));
    return true;
  } catch {
    return false;
  }
}
export function deleteTenderProjectSession(projectId: string): boolean {
  const currentStorage = storage();
  if (!currentStorage) return false;
  try {
    currentStorage.removeItem(projectKey(projectId));
    currentStorage.setItem(
      INDEX_KEY,
      JSON.stringify(listTenderProjectSessions().filter((item) => item.projectId !== projectId)),
    );
    if (currentStorage.getItem(ACTIVE_KEY) === projectId)
      currentStorage.removeItem(ACTIVE_KEY);
    return true;
  } catch {
    return false;
  }
}
export function getActiveTenderProjectId(): string | undefined {
  return storage()?.getItem(ACTIVE_KEY) ?? undefined;
}
export function setActiveTenderProjectId(projectId: string): void {
  try {
    storage()?.setItem(ACTIVE_KEY, projectId);
  } catch {
    // Browser storage is best-effort; the active project remains usable in memory.
  }
}
