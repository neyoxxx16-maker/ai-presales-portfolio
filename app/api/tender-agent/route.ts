import { NextResponse } from "next/server";
import {
  listCompanyChunks,
  workspaceStats,
} from "@/lib/tender-agent/company-workspace";
import { embeddingProviderStatus } from "@/lib/tender-agent/embedding-provider";
import { parseBidDocument } from "@/lib/tender-agent/file-parser";
import { tavilyConfigured } from "@/lib/tender-agent/external-verification";
import {
  answerTenderQuestion,
  runTenderAgent,
} from "@/lib/tender-agent/orchestrator";
import type {
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
  const ocrProvider = process.env.TENDER_OCR_PROVIDER || "paddleocr";
  const ocrReady =
    ocrProvider === "paddleocr" ||
    (ocrProvider === "azure-document-intelligence" &&
      process.env.TENDER_OCR_ENDPOINT &&
      process.env.TENDER_OCR_API_KEY);
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
      if (action === "parse")
        return NextResponse.json({
          files: await Promise.all(
            files.map((file) => parseBidDocument(file, true)),
          ),
        });
      const result = await runTenderAgent({
        mode: "upload",
        files,
        companyMode,
      });
      return NextResponse.json({ files: result.files, result });
    }
    const body = (await request.json()) as TenderAgentRequest & {
      action?: "question";
      result?: TenderAgentResult;
      conversation?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    if (body.action === "question") {
      if (!body.result || !body.task?.trim())
        return NextResponse.json(
          { message: "请先完成投标分析并输入问题。" },
          { status: 400 },
        );
      return NextResponse.json(
        await answerTenderQuestion(body.result, body.task.trim(), body.conversation),
      );
    }
    if (body.mode !== "sample")
      return NextResponse.json(
        { message: "请上传一份招标文件，或运行示例文件。" },
        { status: 400 },
      );
    return NextResponse.json({ result: await runTenderAgent(body) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    console.error("Tender Agent request failed", code || "unknown_error");
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
