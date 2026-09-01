import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ocrDocument } from "@/lib/tender-agent/ocr";
import type { BidDocumentFileType, ParsedBidDocument } from "@/types/tender-agent";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const supportedExtensions: Record<string, BidDocumentFileType> = { ".txt": "TXT", ".md": "MARKDOWN", ".docx": "DOCX", ".pdf": "PDF", ".png": "PNG", ".jpg": "JPG", ".jpeg": "JPEG" };

function extensionOf(fileName: string) { const dot = fileName.lastIndexOf("."); return dot >= 0 ? fileName.slice(dot).toLowerCase() : ""; }
function cleanText(text: string) { return text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim(); }
function chunking(text: string) { const headings = text.match(/^(?:[一二三四五六七八九十]+、|第[一二三四五六七八九十\d]+[章节]|\d+(?:\.\d+){0,3}[、.．])/gm) ?? []; return headings.length ? { sectionCount: headings.length, chunkingMethod: "heading" as const } : { sectionCount: Math.max(1, text.split(/\n\s*\n/).filter(Boolean).length), chunkingMethod: "fallback" as const }; }
function parseError(error: unknown, kind: string) { const detail = error instanceof Error ? error.message : ""; if (/password/i.test(detail)) return `${kind}已加密，当前无法读取。`;
  return `${kind}无法读取，文件可能已损坏或格式不正确。`; }
function textResult(file: File, type: BidDocumentFileType, text: string, parseMethod: ParsedBidDocument["parseMethod"], extra: Pick<ParsedBidDocument, "pageCount" | "warning"> = {}): ParsedBidDocument {
  const normalized = cleanText(text); if (!normalized) throw new Error("empty_file"); const layout = chunking(normalized); return { fileName: file.name, fileType: type, fileSize: file.size, text: normalized, canonicalDocumentText: normalized, characterCount: normalized.length, ...layout, parseMethod, status: "PARSED", ...extra };
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
  let parser: PDFParse | undefined;
  try {
    parser = new PDFParse({ data: buffer }); const info = await parser.getInfo(); const extracted = await parser.getText(); const text = cleanText(extracted.text); const pageCount = info.total || 1;
    const reliableText = text.length >= Math.max(30, pageCount * 30);
    if (!reliableText) { if (!allowOcr) return { fileName: file.name, fileType, fileSize: file.size, text: "", canonicalDocumentText: "", characterCount: text.length, sectionCount: 0, chunkingMethod: "fallback", pageCount, parseMethod: "pdf_text", status: "OCR_REQUIRED", warning: "检测到扫描型或文字层不足的 PDF，等待 Agent 决定是否调用 OCR。" }; const ocr = await ocrDocument(buffer, file.type || "application/pdf"); if (ocr.status === "OCR_SUCCEEDED") return textResult(file, fileType, ocr.text, "ocr", { pageCount: ocr.pageResults.length || pageCount, warning: ocr.warnings.join(" ") || "已通过 OCR 提取扫描件文字，关键字段建议人工核验原件。" }); return { fileName: file.name, fileType, fileSize: file.size, text: "", canonicalDocumentText: "", characterCount: text.length, sectionCount: 0, chunkingMethod: "fallback", pageCount, parseMethod: "pdf_text", status: "OCR_REQUIRED", warning: ocr.warnings.join(" ") || "检测到扫描型 PDF，但 OCR 未成功。" }; }
    return textResult(file, fileType, text, "pdf_text", { pageCount });
  } catch (error) { throw new Error(parseError(error, "PDF 文件")); }
  finally { if (parser) await parser.destroy().catch(() => undefined); }
}

export const bidDocumentUploadLimits = { maxFileSize: MAX_FILE_SIZE, extensions: Object.keys(supportedExtensions) };
