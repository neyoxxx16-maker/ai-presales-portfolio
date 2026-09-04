import { PDFDocument } from "pdf-lib";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export type OcrResult = { status: "OCR_SUCCEEDED" | "OCR_FAILED" | "OCR_UNAVAILABLE"; text: string; confidence?: number; pageResults: Array<{ page: number; text: string; confidence?: number }>; warnings: string[]; provider: string; durationMs: number };
type AzureReadResult = Omit<OcrResult, "provider" | "durationMs" | "warnings">;
type OcrBatch = { buffer: Buffer; pageNumbers: number[] };

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const AZURE_DOCUMENT_INTELLIGENCE = "azure-document-intelligence";
const AZURE_BATCH_PAGE_LIMIT = 2;
const azureProviderAliases = new Set(["azure", "azure-read", AZURE_DOCUMENT_INTELLIGENCE]);
const execFileAsync = promisify(execFile);

function config() {
  const configuredProvider = process.env.TENDER_OCR_PROVIDER?.trim().toLowerCase();
  return { provider: configuredProvider || "paddleocr", isAzureProvider: azureProviderAliases.has(configuredProvider ?? ""), endpoint: process.env.TENDER_OCR_ENDPOINT?.replace(/\/$/, ""), key: process.env.TENDER_OCR_API_KEY, python: process.env.TENDER_OCR_PYTHON || "python" };
}
function diagnostic(values: { provider: string; endpointConfigured: boolean; apiKeyConfigured: boolean; azureRequestStarted: boolean; azureResponseStatus?: number; azureResultCharacterCount?: number; reason?: string }) { console.info("[tender-ocr]", { ocrRequired: true, ...values }); }
function pageDiagnostic(pageNumber: number, extractedCharacterCount: number, failure?: string) { const payload = { pageNumber, extractedCharacterCount, source: "azure_ocr", ...(failure ? { failure } : {}) }; if (failure) console.error("[tender-ocr-page]", payload); else console.info("[tender-ocr-page]", payload); }

async function paddleOcr(buffer: Buffer, mimeType: string, python: string): Promise<OcrResult> {
  const started = Date.now();
  const temporary = await mkdtemp(path.join(os.tmpdir(), "tender-paddle-"));
  const extension = mimeType.includes("pdf") ? ".pdf" : mimeType.includes("png") ? ".png" : ".jpg";
  const input = path.join(temporary, `source${extension}`);
  const script = path.join(process.cwd(), "scripts", "paddle-ocr.py");
  try {
    await writeFile(input, buffer);
    const { stdout } = await execFileAsync(python, [script, "--input", input], {
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1" },
    });
    const json = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!json) throw new Error("PaddleOCR 未返回识别结果。");
    const result = JSON.parse(json) as {
      status: "OCR_SUCCEEDED" | "OCR_FAILED";
      text?: string;
      confidence?: number;
      pageResults?: OcrResult["pageResults"];
      durationMs?: number;
      error?: string;
    };
    return {
      status: result.status,
      text: result.text || "",
      confidence: result.confidence,
      pageResults: result.pageResults || [],
      warnings: result.status === "OCR_SUCCEEDED" ? [] : [result.error || "PaddleOCR 未识别出可用文本。"],
      provider: "paddleocr",
      durationMs: result.durationMs ?? Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const unavailable = /No module named ['\"](?:paddleocr|paddle|fitz)|ENOENT/.test(message);
    return {
      status: unavailable ? "OCR_UNAVAILABLE" : "OCR_FAILED",
      text: "",
      pageResults: [],
      warnings: [unavailable ? "PaddleOCR 本地依赖未安装或 Python 不可用。" : `PaddleOCR 调用失败：${message}`],
      provider: "paddleocr",
      durationMs: Date.now() - started,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function splitPdfForAzure(buffer: Buffer, mimeType: string): Promise<OcrBatch[]> {
  if (!mimeType.includes("pdf")) return [{ buffer, pageNumbers: [1] }];
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true }); const batches: OcrBatch[] = [];
  for (let start = 0; start < source.getPageCount(); start += AZURE_BATCH_PAGE_LIMIT) {
    const pageNumbers = Array.from({ length: Math.min(AZURE_BATCH_PAGE_LIMIT, source.getPageCount() - start) }, (_, index) => start + index + 1);
    const chunk = await PDFDocument.create(); const pages = await chunk.copyPages(source, pageNumbers.map((page) => page - 1)); pages.forEach((page) => chunk.addPage(page));
    batches.push({ buffer: Buffer.from(await chunk.save()), pageNumbers });
  }
  return batches;
}

async function azureRead(buffer: Buffer, mimeType: string, provider: string, endpoint: string, key: string): Promise<AzureReadResult> {
  const endpointConfigured = Boolean(endpoint); const apiKeyConfigured = Boolean(key);
  diagnostic({ provider, endpointConfigured, apiKeyConfigured, azureRequestStarted: true });
  const submit = await fetch(`${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?_overload=analyzeDocument&api-version=2024-11-30`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": mimeType || "application/octet-stream" }, body: new Uint8Array(buffer), signal: AbortSignal.timeout(30000) });
  const operation = submit.headers.get("operation-location"); diagnostic({ provider, endpointConfigured, apiKeyConfigured, azureRequestStarted: true, azureResponseStatus: submit.status });
  if (submit.status !== 202 || !operation) throw new Error(`ocr_submit_${submit.status}`);
  for (let attempt = 0; attempt < 15; attempt++) {
    await delay(1000); const response = await fetch(operation, { headers: { "Ocp-Apim-Subscription-Key": key }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) { diagnostic({ provider, endpointConfigured, apiKeyConfigured, azureRequestStarted: true, azureResponseStatus: response.status }); throw new Error(`ocr_poll_${response.status}`); }
    const data = await response.json() as { status?: string; analyzeResult?: { pages?: Array<{ pageNumber?: number; lines?: Array<{ content?: string; words?: Array<{ confidence?: number }> }> }> }; error?: { message?: string } };
    if (data.status === "succeeded") {
      const pageResults = (data.analyzeResult?.pages ?? []).map((page, index) => { const lines = page.lines ?? []; const confidences = lines.flatMap((line) => line.words?.map((word) => word.confidence).filter((value): value is number => typeof value === "number") ?? []); return { page: page.pageNumber ?? index + 1, text: lines.map((line) => line.content ?? "").filter(Boolean).join("\n"), confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined }; });
      const text = pageResults.map((page) => page.text).filter(Boolean).join("\n\n"); diagnostic({ provider, endpointConfigured, apiKeyConfigured, azureRequestStarted: true, azureResponseStatus: response.status, azureResultCharacterCount: text.length });
      return { status: text ? "OCR_SUCCEEDED" : "OCR_FAILED", text, pageResults, confidence: undefined };
    }
    if (data.status === "failed") throw new Error(data.error?.message || "ocr_failed");
  }
  throw new Error("ocr_timeout");
}

export async function ocrDocument(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  const { provider, isAzureProvider, endpoint, key, python } = config();
  if (provider === "paddleocr") return paddleOcr(buffer, mimeType, python);
  const endpointConfigured = Boolean(endpoint); const apiKeyConfigured = Boolean(key);
  if (!isAzureProvider || !endpoint || !key) { diagnostic({ provider, endpointConfigured, apiKeyConfigured, azureRequestStarted: false, azureResultCharacterCount: 0, reason: !isAzureProvider ? "unsupported_provider" : "azure_configuration_missing" }); return { status: "OCR_UNAVAILABLE", text: "", pageResults: [], warnings: ["Azure Document Intelligence OCR 未配置或 provider 无效。支持的 TENDER_OCR_PROVIDER 值：paddleocr、azure、azure-read、azure-document-intelligence。"], provider, durationMs: 0 }; }
  const started = Date.now(); let batches: OcrBatch[];
  try { batches = await splitPdfForAzure(buffer, mimeType); } catch (error) { diagnostic({ provider, endpointConfigured, apiKeyConfigured, azureRequestStarted: false, azureResultCharacterCount: 0, reason: `pdf_split_failed:${error instanceof Error ? error.message : "unknown"}` }); return { status: "OCR_FAILED", text: "", pageResults: [], warnings: ["OCR 前无法按页拆分 PDF，未提交不完整的 Azure OCR 请求。"], provider, durationMs: Date.now() - started }; }
  const pageResults: OcrResult["pageResults"] = []; const warnings: string[] = [];
  for (const batch of batches) {
    try {
      const result = await azureRead(batch.buffer, mimeType, provider, endpoint, key); if (result.status !== "OCR_SUCCEEDED") throw new Error("ocr_empty_result");
      for (const pageNumber of batch.pageNumbers) {
        const localIndex = pageNumber - batch.pageNumbers[0];
        const localPageNumber = localIndex + 1;
        // Azure commonly renumbers split batches from 1, but some responses keep
        // the original PDF page number. Accept either form, then retain batch order
        // as a final fallback so a later PDF page is never silently dropped.
        const page = result.pageResults.find((item) => item.page === localPageNumber)
          ?? result.pageResults.find((item) => item.page === pageNumber)
          ?? result.pageResults[localIndex];
        const text = page?.text ?? "";
        const confidence = page?.confidence;
        pageDiagnostic(pageNumber, text.length, text ? undefined : "azure_page_missing");
        if (text) pageResults.push({ page: pageNumber, text, confidence });
        else warnings.push(`Azure OCR 未返回第 ${pageNumber} 页文字。`);
      }
    } catch (error) { const failure = error instanceof Error ? error.message : "unknown"; for (const pageNumber of batch.pageNumbers) pageDiagnostic(pageNumber, 0, failure); warnings.push(`Azure OCR 第 ${batch.pageNumbers.join("-")} 页失败：${failure}`); }
  }
  const text = pageResults.map((page) => page.text).join("\n\n"); const confidenceValues = pageResults.map((page) => page.confidence).filter((value): value is number => value !== undefined); const confidence = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : undefined;
  diagnostic({ provider, endpointConfigured, apiKeyConfigured, azureRequestStarted: true, azureResultCharacterCount: text.length, ...(warnings.length ? { reason: "partial_or_failed_pages" } : {}) });
  return { status: text ? "OCR_SUCCEEDED" : "OCR_FAILED", text, confidence, pageResults, warnings: [...warnings, ...(confidence && confidence < .85 ? ["OCR 置信度较低；证书编号、日期、金额和人员姓名建议人工核验原件。"] : [])], provider, durationMs: Date.now() - started };
}
