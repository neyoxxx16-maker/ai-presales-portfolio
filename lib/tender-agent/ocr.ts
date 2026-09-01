import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export type OcrResult = { status: "OCR_SUCCEEDED" | "OCR_FAILED" | "OCR_UNAVAILABLE"; text: string; confidence?: number; pageResults: Array<{ page: number; text: string; confidence?: number }>; warnings: string[]; provider: string; durationMs: number };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);
function config() { return { provider: process.env.TENDER_OCR_PROVIDER || "paddleocr", endpoint: process.env.TENDER_OCR_ENDPOINT?.replace(/\/$/, ""), key: process.env.TENDER_OCR_API_KEY, python: process.env.TENDER_OCR_PYTHON || "python" }; }

async function paddleOcr(buffer: Buffer, mimeType: string, python: string): Promise<OcrResult> {
  const started = Date.now(); const temporary = await mkdtemp(path.join(os.tmpdir(), "tender-paddle-")); const extension = mimeType.includes("pdf") ? ".pdf" : mimeType.includes("png") ? ".png" : ".jpg"; const input = path.join(temporary, `source${extension}`); const script = path.join(process.cwd(), "scripts", "paddle-ocr.py");
  try { await writeFile(input, buffer); const { stdout } = await execFileAsync(python, [script, "--input", input], { timeout: 180000, maxBuffer: 10 * 1024 * 1024, windowsHide: true, env: { ...process.env, PYTHONUTF8: "1" } }); const json = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1); if (!json) throw new Error("PaddleOCR 未返回 Observation。"); const result = JSON.parse(json) as { status: "OCR_SUCCEEDED" | "OCR_FAILED"; text?: string; confidence?: number; pageResults?: OcrResult["pageResults"]; durationMs?: number; error?: string }; return { status: result.status, text: result.text || "", confidence: result.confidence, pageResults: result.pageResults || [], warnings: result.status === "OCR_SUCCEEDED" ? [] : [result.error || "PaddleOCR 未识别出可用文本。"], provider: "paddleocr", durationMs: result.durationMs ?? Date.now() - started }; }
  catch (error) { const message = error instanceof Error ? error.message : "unknown"; const unavailable = /No module named ['\"](?:paddleocr|paddle|fitz)|ENOENT/.test(message); return { status: unavailable ? "OCR_UNAVAILABLE" : "OCR_FAILED", text: "", pageResults: [], warnings: [unavailable ? "PaddleOCR 本地依赖未安装或 Python 不可用。" : `PaddleOCR 调用失败：${message}`], provider: "paddleocr", durationMs: Date.now() - started }; }
  finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function ocrDocument(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  const { provider, endpoint, key } = config();
  if (provider === "paddleocr") return paddleOcr(buffer, mimeType, config().python);
  if (provider !== "azure-document-intelligence" || !endpoint || !key) return { status: "OCR_UNAVAILABLE", text: "", pageResults: [], warnings: ["OCR Provider 未配置。"], provider: provider || "not-configured", durationMs: 0 };
  const started = Date.now();
  try {
    const submit = await fetch(`${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": mimeType || "application/octet-stream" }, body: new Uint8Array(buffer), signal: AbortSignal.timeout(30000) });
    const operation = submit.headers.get("operation-location"); if (submit.status !== 202 || !operation) throw new Error(`ocr_submit_${submit.status}`);
    for (let attempt = 0; attempt < 15; attempt++) { await delay(1000); const response = await fetch(operation, { headers: { "Ocp-Apim-Subscription-Key": key }, signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`ocr_poll_${response.status}`); const data = await response.json() as { status?: string; analyzeResult?: { pages?: Array<{ pageNumber?: number; lines?: Array<{ content?: string; words?: Array<{ confidence?: number }> }> }> }; error?: { message?: string } }; if (data.status === "succeeded") { const pageResults = (data.analyzeResult?.pages ?? []).map((page, index) => { const lines = page.lines ?? []; const confidences = lines.flatMap((line) => line.words?.map((word) => word.confidence).filter((value): value is number => typeof value === "number") ?? []); return { page: page.pageNumber ?? index + 1, text: lines.map((line) => line.content ?? "").filter(Boolean).join("\n"), confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined }; }); const text = pageResults.map((page) => page.text).filter(Boolean).join("\n\n"); const confidence = pageResults.filter((page) => page.confidence !== undefined).reduce((sum, page, _, list) => sum + (page.confidence ?? 0) / list.length, 0); return { status: text ? "OCR_SUCCEEDED" : "OCR_FAILED", text, confidence: Number.isFinite(confidence) ? confidence : undefined, pageResults, warnings: confidence && confidence < .85 ? ["OCR 置信度较低；证书编号、日期、金额和人员姓名建议人工核验原件。"] : [], provider, durationMs: Date.now() - started }; } if (data.status === "failed") throw new Error(data.error?.message || "ocr_failed"); }
    throw new Error("ocr_timeout");
  } catch (error) { return { status: "OCR_FAILED", text: "", pageResults: [], warnings: [`OCR 调用失败：${error instanceof Error ? error.message : "unknown"}`], provider, durationMs: Date.now() - started }; }
}
