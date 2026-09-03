import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type CompanyStorageProviderName = "local" | "vercel-blob";

export class CompanyStorageUnavailableError extends Error {
  constructor(detail: string) {
    super(`STORAGE_UNAVAILABLE: ${detail}`);
    this.name = "CompanyStorageUnavailableError";
  }
}

export type CompanyStorageProvider = {
  readonly name: CompanyStorageProviderName;
  read(key: string): Promise<Buffer | undefined>;
  write(key: string, value: Buffer | string, contentType?: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

const localRoot = path.join(process.cwd(), "storage", "tender-company");

function configuredProvider(): CompanyStorageProviderName {
  const value = process.env.STORAGE_PROVIDER ?? process.env.TENDER_STORAGE_PROVIDER;
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new CompanyStorageUnavailableError("Production 未配置 STORAGE_PROVIDER。");
    return "local";
  }
  if (value === "local" || value === "vercel-blob") return value;
  throw new CompanyStorageUnavailableError(`未知 STORAGE_PROVIDER：${value}`);
}

function localStorage(): CompanyStorageProvider {
  const toPath = (key: string) => path.join(localRoot, ...key.split("/"));
  return {
    name: "local",
    async read(key) {
      try { return await readFile(toPath(key)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw new CompanyStorageUnavailableError("Local filesystem 读取失败。"); }
    },
    async write(key, value) {
      try { const target = toPath(key); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, value); }
      catch { throw new CompanyStorageUnavailableError("Local filesystem 写入失败。"); }
    },
    async remove(keys) {
      try { await Promise.all(keys.map(async (key) => { try { await unlink(toPath(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } })); }
      catch { throw new CompanyStorageUnavailableError("Local filesystem 删除失败。"); }
    },
  };
}

function blobCredentialsAvailable() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
}

function blobStorage(): CompanyStorageProvider {
  if (!blobCredentialsAvailable()) throw new CompanyStorageUnavailableError("Vercel Blob 凭据未配置。");
  const pathname = (key: string) => `tender-company/${key}`;
  return {
    name: "vercel-blob",
    async read(key) {
      try { const result = await get(pathname(key), { access: "private", useCache: false }); if (!result || result.statusCode !== 200 || !result.stream) return undefined; return Buffer.from(await new Response(result.stream).arrayBuffer()); }
      catch { throw new CompanyStorageUnavailableError("Vercel Blob 读取失败。"); }
    },
    async write(key, value, contentType = "application/octet-stream") {
      try { await put(pathname(key), value, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType }); }
      catch { throw new CompanyStorageUnavailableError("Vercel Blob 写入失败。"); }
    },
    async remove(keys) {
      if (!keys.length) return;
      try { await del(keys.map(pathname)); }
      catch { throw new CompanyStorageUnavailableError("Vercel Blob 删除失败。"); }
    },
  };
}

export function getCompanyStorageProvider(): CompanyStorageProvider {
  return configuredProvider() === "vercel-blob" ? blobStorage() : localStorage();
}

export async function readCompanyJson<T>(provider: CompanyStorageProvider, key: string, fallback: T): Promise<T> {
  const value = await provider.read(key);
  if (!value) return fallback;
  try { return JSON.parse(value.toString("utf8")) as T; } catch { throw new CompanyStorageUnavailableError(`存储中的 ${key} 不是有效 JSON。`); }
}

export async function writeCompanyJson(provider: CompanyStorageProvider, key: string, value: unknown): Promise<void> {
  await provider.write(key, JSON.stringify(value, null, 2), "application/json; charset=utf-8");
}
