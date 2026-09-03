import { del, put } from "@vercel/blob";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type StorageProviderName = "local" | "vercel-blob";

export class TenderUploadStorageUnavailableError extends Error {
  constructor(detail: string) {
    super(`STORAGE_UNAVAILABLE: ${detail}`);
    this.name = "TenderUploadStorageUnavailableError";
  }
}

const localRoot = path.join(process.cwd(), "storage", "tender-uploads");
const log = (event: string, detail: Record<string, unknown>) => console.info("[tender-upload-storage]", { event, ...detail });
function activeProvider(): StorageProviderName {
  const value = (process.env.STORAGE_PROVIDER ?? process.env.TENDER_STORAGE_PROVIDER ?? "").trim();
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new TenderUploadStorageUnavailableError("Production 未配置 STORAGE_PROVIDER。");
    return "local";
  }
  if (value === "local" || value === "vercel-blob") return value;
  throw new TenderUploadStorageUnavailableError(`未知 STORAGE_PROVIDER：${value}`);
}
function blobCredentialsAvailable() { return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID); }
const safeSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
const keyFor = (projectId: string, file: File, index: number) => `projects/${safeSegment(projectId)}/files/${String(index + 1).padStart(2, "0")}-${safeSegment(file.name)}`;
const blobPath = (key: string) => `tender-uploads/${key}`;
const validKey = (projectId: string, key: string) => key.startsWith(`projects/${safeSegment(projectId)}/files/`);

export async function persistTenderUploads(files: File[], projectId: string, existingKeys: string[] = []) {
  if (!projectId.trim()) throw new TenderUploadStorageUnavailableError("缺少招标项目存储标识。");
  const provider = activeProvider();
  log("provider_selected", { provider, fileCount: files.length });
  if (provider === "vercel-blob" && !blobCredentialsAvailable()) throw new TenderUploadStorageUnavailableError("Vercel Blob 凭据未配置。");
  return Promise.all(files.map(async (file, index) => {
    const existingKey = existingKeys[index];
    if (existingKey && validKey(projectId, existingKey)) return { storageKey: existingKey };
    const storageKey = keyFor(projectId, file, index);
    if (provider === "local") {
      try { const target = path.join(localRoot, ...storageKey.split("/")); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, Buffer.from(await file.arrayBuffer())); log("put_succeeded", { provider, pathname: storageKey }); return { storageKey }; }
      catch { throw new TenderUploadStorageUnavailableError("Local filesystem 写入失败。"); }
    }
    const pathname = blobPath(storageKey);
    log("put_started", { provider, pathname });
    try {
      const blob = await put(pathname, Buffer.from(await file.arrayBuffer()), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: file.type || "application/octet-stream" });
      log("put_succeeded", { provider, pathname: blob.pathname, blobUrl: blob.url });
      return { storageKey };
    } catch { throw new TenderUploadStorageUnavailableError("Vercel Blob 写入失败。"); }
  }));
}

export async function deleteTenderUpload(projectId: string, storageKey: string) {
  if (!validKey(projectId, storageKey)) throw new TenderUploadStorageUnavailableError("招标文件存储路径无效。");
  const provider = activeProvider();
  log("provider_selected", { provider, operation: "delete" });
  if (provider === "vercel-blob" && !blobCredentialsAvailable()) throw new TenderUploadStorageUnavailableError("Vercel Blob 凭据未配置。");
  if (provider === "local") {
    try { await unlink(path.join(localRoot, ...storageKey.split("/"))).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); log("delete_succeeded", { provider, pathname: storageKey }); return; }
    catch { throw new TenderUploadStorageUnavailableError("Local filesystem 删除失败。"); }
  }
  const pathname = blobPath(storageKey);
  log("delete_started", { provider, pathname });
  try { await del(pathname); log("delete_succeeded", { provider, pathname }); }
  catch { throw new TenderUploadStorageUnavailableError("Vercel Blob 删除失败。"); }
}
