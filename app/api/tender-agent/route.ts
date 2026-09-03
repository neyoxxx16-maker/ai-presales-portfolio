import { NextResponse } from "next/server";
import {
  listCompanyChunks,
  workspaceStats,
} from "@/lib/tender-agent/company-workspace";
import { embeddingProviderStatus } from "@/lib/tender-agent/embedding-provider";
import { parseBidDocument } from "@/lib/tender-agent/file-parser";
import { deleteTenderUpload, persistTenderUploads } from "@/lib/tender-agent/tender-upload-storage";
import { tavilyConfigured } from "@/lib/tender-agent/external-verification";
import {
  answerTenderQuestion,
  runTenderAgent,
} from "@/lib/tender-agent/orchestrator";
import type {
  ParsedBidDocument,
  TenderAgentRequest,
  TenderAgentResult,
} from "@/types/tender-agent";

export const runtime = "nodejs";
export async function GET() {
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  const workspace = await workspaceStats();
  const chunks = await listCompanyChunks();
  const embedding = embeddingProviderStatus();
  const ocrProvider = (process.env.TENDER_OCR_PROVIDER || "azure-document-intelligence").trim().toLowerCase();
  const ocrReady =
    ["azure", "azure-read", "azure-document-intelligence"].includes(ocrProvider) &&
    process.env.TENDER_OCR_ENDPOINT &&
    process.env.TENDER_OCR_API_KEY;
  return NextResponse.json({
    capabilities: {
      deepSeek: {
        status: process.env.DEEPSEEK_API_KEY ? "configured" : "not_configured",
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      },
      workspace: {
        status: "available",
        documents: workspace.documents,
        chunks: chunks.length,
        parsed: workspace.parsed,
      },
      embedding: {
        status: embedding.enabled ? "enabled" : "disabled",
        provider: embedding.provider,
        model: embedding.model,
      },
      ocr: {
        status: ocrReady ? "configured" : "not_configured",
        provider: ocrProvider,
      },
      tavily: {
        status:
          tavilyConfigured() && (!process.env.TENDER_WEB_SEARCH_PROVIDER || process.env.TENDER_WEB_SEARCH_PROVIDER === "tavily")
            ? "configured"
            : "not_configured",
      },
    },
  });
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData
        .getAll("file")
        .filter(
          (file): file is File =>
            typeof file === "object" &&
            file !== null &&
            "arrayBuffer" in file &&
            "name" in file,
        );
      if (!files.length)
        return NextResponse.json(
          { message: "请至少选择一份招标文件后再上传。" },
          { status: 400 },
        );
      const companyMode =
        formData.get("companyMode") === "workspace" ? "workspace" : "demo";
      const action = String(formData.get("action") || "analyze");
      const projectId = String(formData.get("projectId") || "");
      const storageKeys = formData.getAll("storageKey").map(String);
      if (action === "parse") {
        const parsedFiles = await Promise.all(files.map((file) => parseBidDocument(file, true)));
        const stored = await persistTenderUploads(files, projectId, storageKeys);
        return NextResponse.json({
          files: parsedFiles.map((file, index) => ({ ...file, storageKey: stored[index]?.storageKey })),
        });
      }
      const stored = await persistTenderUploads(files, projectId, storageKeys);
      const result = await runTenderAgent({
        mode: "upload",
        files,
        companyMode,
      });
      result.files = result.files?.map((file, index) => ({ ...file, storageKey: stored[index]?.storageKey }));
      return NextResponse.json({ files: result.files, result });
    }
    const body = (await request.json()) as Omit<TenderAgentRequest, "files"> & {
      action?: "question" | "deleteFile";
      analysisSessionId?: string;
      result?: TenderAgentResult;
      conversation?: Array<{ role: "user" | "assistant"; content: string }>;
      files?: ParsedBidDocument[];
    };
    if (body.action === "question") {
      if (!body.result || !body.task?.trim() || !body.analysisSessionId)
        return NextResponse.json(
          { message: "当前分析会话无效，请重新完成投标分析后再提问。" },
          { status: 400 },
        );
      return NextResponse.json(
        await answerTenderQuestion(body.result, body.task.trim(), body.conversation),
      );
    }
    if (body.action === "deleteFile") {
      const projectId = String((body as { projectId?: unknown }).projectId || "");
      const storageKey = String((body as { storageKey?: unknown }).storageKey || "");
      await deleteTenderUpload(projectId, storageKey);
      return NextResponse.json({ deleted: true });
    }
    if (body.action === "reanalyze") {
      if (!body.files?.length)
        return NextResponse.json(
          { message: "历史项目未保留可重新分析的解析文本。" },
          { status: 400 },
        );
      const content = body.files
        .map(
          (file) =>
            `[[SOURCE:${file.fileName}]]\n${file.canonicalDocumentText || file.text}`,
        )
        .join("\n\n");
      return NextResponse.json({
        result: await runTenderAgent({
          mode: "upload",
          fileName: `${body.files.length} 份历史招标项目资料`,
          content,
          companyMode: body.companyMode,
        }),
      });
    }
    if (body.mode !== "sample")
      return NextResponse.json(
        { message: "请上传一份招标文件，或运行示例文件。" },
        { status: 400 },
      );
    const { action: _action, analysisSessionId: _session, result: _result, conversation: _conversation, files: _files, ...agentRequest } = body;
    return NextResponse.json({ result: await runTenderAgent(agentRequest) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    console.error("Tender Agent request failed", code || "unknown_error");
    if (code.startsWith("STORAGE_UNAVAILABLE"))
      return NextResponse.json({ code: "STORAGE_UNAVAILABLE", message: "STORAGE_UNAVAILABLE" }, { status: 503 });
    const message =
      code === "unsupported_file_type"
        ? "仅支持 PDF、DOCX、TXT 或 Markdown 格式的招标文件。"
        : code === "empty_file"
          ? "文件为空，无法解析。"
          : code === "file_too_large"
            ? "文件超过 15 MB，请先精简后再上传。"
            : code === "invalid_document"
              ? "文件内容不足，无法识别招标正文。"
              : code.includes("无法读取") || code.includes("已加密")
                ? code
                : "投标分析请求失败，请重试。";
    return NextResponse.json({ message }, { status: 502 });
  }
}
