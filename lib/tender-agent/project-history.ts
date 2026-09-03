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
function stableFileId(projectId: string, file: ParsedBidDocument, index: number) {
  const seed = `${projectId}:${file.fileName}:${file.fileSize}:${file.canonicalDocumentText.slice(0, 80)}:${index}`;
  let hash = 0;
  for (let cursor = 0; cursor < seed.length; cursor++) hash = (hash * 31 + seed.charCodeAt(cursor)) >>> 0;
  return `tender-file-${hash.toString(36)}`;
}
export function hydrateTenderProjectFiles(projectId: string, files: ParsedBidDocument[]) {
  return files.map((file, index) => ({ ...file, projectId, fileId: file.fileId ?? stableFileId(projectId, file, index) }));
}
/** Deletes one file from persisted project metadata without deleting the project itself. */
export function deleteTenderProjectFile(projectId: string, fileId: string): TenderProjectSession | undefined {
  const session = getTenderProjectSession(projectId);
  if (!session) return undefined;
  const files = hydrateTenderProjectFiles(projectId, session.files).filter((file) => file.fileId !== fileId);
  const hasRecoverableContent = Boolean(session.result) || session.conversations.length > 0;
  if (!files.length && !hasRecoverableContent) {
    deleteTenderProjectSession(projectId);
    return undefined;
  }
  const next: TenderProjectSession = {
    ...session,
    files,
    result: session.result ? { ...session.result, files } : undefined,
    conversations: session.conversations,
    status: session.status,
    updatedAt: new Date().toISOString(),
    lastAnalyzedAt: session.lastAnalyzedAt,
  };
  return saveTenderProjectSession(next) ? next : undefined;
}

/** Project payloads are stored by id so one tender never overwrites another. */
export function listTenderProjectSessions(): TenderProjectIndexItem[] {
  const currentStorage = storage();
  const index = parse<TenderProjectIndexItem[]>(currentStorage?.getItem(INDEX_KEY) ?? null) ?? [];
  const retained = index.filter((item) => {
    const session = parse<TenderProjectSession>(currentStorage?.getItem(projectKey(item.projectId)) ?? null);
    return Boolean(session && (session.files.length || session.result || session.conversations.length));
  });
  if (currentStorage && retained.length !== index.length)
    currentStorage.setItem(INDEX_KEY, JSON.stringify(retained));
  return retained.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
export function getTenderProjectSession(projectId: string): TenderProjectSession | undefined {
  const currentStorage = storage();
  const session = parse<TenderProjectSession>(currentStorage?.getItem(projectKey(projectId)) ?? null);
  return session ? { ...session, files: hydrateTenderProjectFiles(projectId, session.files) } : undefined;
}
export function saveTenderProjectSession(session: TenderProjectSession): boolean {
  const currentStorage = storage();
  if (!currentStorage) return false;
  try {
    const normalized = { ...session, files: hydrateTenderProjectFiles(session.projectId, session.files) };
    currentStorage.setItem(projectKey(session.projectId), JSON.stringify(normalized));
    const nextIndex = [
      toIndexItem(normalized),
      ...listTenderProjectSessions().filter((item) => item.projectId !== normalized.projectId),
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
