import mammoth from "mammoth";
import { ocrDocument } from "@/lib/tender-agent/ocr";
import type { BidDocumentFileType, ParsedBidDocument } from "@/types/tender-agent";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const supportedExtensions: Record<string, BidDocumentFileType> = { ".txt": "TXT", ".md": "MARKDOWN", ".docx": "DOCX", ".pdf": "PDF", ".png": "PNG", ".jpg": "JPG", ".jpeg": "JPEG" };

type PdfParser = {
  getInfo(): Promise<{ total?: number }>;
  getText(): Promise<{ text: string; pages: Array<{ num: number; text: string }> }>;
  destroy(): Promise<void>;
};
type PdfParserConstructor = new (options: { data: Buffer }) => PdfParser;

function loadNodePdfParser(): PdfParserConstructor {
  // Use the CommonJS condition only when a PDF actually needs parsing. This keeps
  // PDF.js out of the API route's initialization path and prevents Next from
  // selecting the browser-oriented ESM condition for this server-only work.
  const pdfParse = require("pdf-parse") as { PDFParse?: PdfParserConstructor };
  if (typeof pdfParse.PDFParse !== "function")
    throw new Error("pdf_parser_unavailable");
  return pdfParse.PDFParse;
}

function logPdfParserFailure(error: unknown, file: File, byteLength: number) {
  const exception = error instanceof Error ? error : new Error(String(error));
  // Keep the client-facing validation message stable, but never hide the
  // underlying server exception in Vercel Runtime Logs.
  console.error("[tender-pdf-parser] extraction_failed", {
    parser: "pdf-parse@2.4.5 / pdfjs-dist legacy Node CJS",
    fileName: file.name,
    declaredFileSize: file.size,
    parsedByteLength: byteLength,
    nodeVersion: process.version,
    errorName: exception.name,
    errorMessage: exception.message,
    errorStack: exception.stack,
  });
}

function extensionOf(fileName: string) { const dot = fileName.lastIndexOf("."); return dot >= 0 ? fileName.slice(dot).toLowerCase() : ""; }
function cleanText(text: string) { return text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim(); }
function needsPdfOcr(text: string, pages: Array<{ pageNumber: number; text: string }>, pageCount: number) {
  const textCharacters = text.replace(/\s/g, "").length;
  const pageCharacters = pages.map((page) => cleanText(page.text).replace(/\s/g, "").length);
  const effectivePageCount = Math.max(pageCount, pageCharacters.length, 1);
  const averageCharactersPerPage = textCharacters / effectivePageCount;
  const mostlyEmptyPages = pageCharacters.length > 0 && pageCharacters.filter((count) => count < 20).length / pageCharacters.length >= 0.6;
  return textCharacters < 80 || averageCharactersPerPage < 60 || mostlyEmptyPages;
}
function chunking(text: string) { const headings = text.match(/^(?:[一二三四五六七八九十]+、|第[一二三四五六七八九十\d]+[章节]|\d+(?:\.\d+){0,3}[、.．])/gm) ?? []; return headings.length ? { sectionCount: headings.length, chunkingMethod: "heading" as const } : { sectionCount: Math.max(1, text.split(/\n\s*\n/).filter(Boolean).length), chunkingMethod: "fallback" as const }; }
function parseError(error: unknown, kind: string) { const detail = error instanceof Error ? error.message : ""; if (/password/i.test(detail)) return `${kind}已加密，当前无法读取。`;
  return `${kind}无法读取，文件可能已损坏或格式不正确。`; }
function textResult(file: File, type: BidDocumentFileType, text: string, parseMethod: ParsedBidDocument["parseMethod"], extra: Pick<ParsedBidDocument, "pageCount" | "warning" | "pages"> = {}): ParsedBidDocument {
  const normalized = cleanText(text); if (!normalized) throw new Error("empty_file"); const pages = extra.pages?.map((page) => ({ ...page, text: cleanText(page.text) })).filter((page) => page.text); const canonicalDocumentText = pages?.length ? pages.map((page) => `[[PAGE:${page.pageNumber}]]\n${page.text}`).join("\n\n") : normalized; const layout = chunking(normalized); return { fileName: file.name, fileType: type, fileSize: file.size, text: normalized, canonicalDocumentText, characterCount: normalized.length, ...layout, parseMethod, status: "PARSED", ...extra, pages };
}

export async function parseBidDocument(file: File, allowOcr = true): Promise<ParsedBidDocument> {
  const extension = extensionOf(file.name); const fileType = supportedExtensions[extension];
  if (!fileType) throw new Error("unsupported_file_type");
  if (!file.size) throw new Error("empty_file");
  if (file.size > MAX_FILE_SIZE) throw new Error("file_too_large");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (fileType === "TXT" || fileType === "MARKDOWN") return textResult(file, fileType, new TextDecoder("utf-8").decode(buffer), "plain_text");
  if (fileType === "DOCX") {
    try { const extracted = await mammoth.extractRawText({ buffer }); return textResult(file, fileType, extracted.value, "docx_mammoth", extracted.messages.length ? { warning: "文档包含部分无法保留的格式，已提取可读取正文。" } : {}); }
    catch (error) { throw new Error(parseError(error, "Word 文档")); }
  }
  if (fileType === "PNG" || fileType === "JPG" || fileType === "JPEG") return { fileName: file.name, fileType, fileSize: file.size, text: "", canonicalDocumentText: "", characterCount: 0, sectionCount: 0, chunkingMethod: "fallback", parseMethod: "plain_text", status: "OCR_REQUIRED", warning: "图片文件需要通过 OCR 获取文本。" };
  let parser: PdfParser | undefined;
  try {
    const PDFParse = loadNodePdfParser();
    parser = new PDFParse({ data: buffer }); const info = await parser.getInfo(); const extracted = await parser.getText(); const pages = extracted.pages.map((page) => ({ pageNumber: page.num, text: page.text })); const text = cleanText(extracted.text); const pageCount = info.total || 1;
    if (needsPdfOcr(text, pages, pageCount)) { if (!allowOcr) return { fileName: file.name, fileType, fileSize: file.size, text: "", canonicalDocumentText: "", characterCount: text.length, sectionCount: 0, chunkingMethod: "fallback", pageCount, parseMethod: "ocr", status: "OCR_REQUIRED", warning: "PDF 文字层为空、过少或平均每页文本量过低，已判定为扫描型/图片型 PDF，等待 OCR fallback。" }; const ocr = await ocrDocument(buffer, file.type || "application/pdf"); if (ocr.status === "OCR_SUCCEEDED") return textResult(file, fileType, ocr.text, "ocr", { pageCount, pages: ocr.pageResults.map((page) => ({ pageNumber: page.page, text: page.text })), warning: ocr.warnings.join(" ") || "已通过 OCR fallback 提取扫描件文字，关键字段建议人工核验原件。" }); return { fileName: file.name, fileType, fileSize: file.size, text: "", canonicalDocumentText: "", characterCount: text.length, sectionCount: 0, chunkingMethod: "fallback", pageCount, parseMethod: "ocr", status: "OCR_REQUIRED", warning: ocr.warnings.join(" ") || "检测到扫描型 PDF，但 OCR fallback 未成功。" }; }
    return textResult(file, fileType, text, "pdf_text", { pageCount, pages });
  } catch (error) { logPdfParserFailure(error, file, buffer.byteLength); throw new Error(parseError(error, "PDF 文件")); }
  finally { if (parser) await parser.destroy().catch(() => undefined); }
}

export const bidDocumentUploadLimits = { maxFileSize: MAX_FILE_SIZE, extensions: Object.keys(supportedExtensions) };
