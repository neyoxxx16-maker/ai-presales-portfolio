import { NextResponse } from "next/server";
import { runTenderAgent } from "@/lib/tender-agent/orchestrator";
import type { TenderAgentRequest } from "@/types/tender-agent";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try { const body = await request.json() as TenderAgentRequest; if (body.mode !== "sample" && body.mode !== "upload") return NextResponse.json({ message: "请选择示例文件或上传可读取文本。" }, { status: 400 }); return NextResponse.json(await runTenderAgent(body)); }
  catch (error) { const code = error instanceof Error ? error.message : "unknown"; const message = code === "invalid_document" ? "文件为空或无法读取，请使用示例文件或上传可读取的文本。" : code === "document_too_large" ? "文件内容过长，请先截取需要分析的招标章节。" : "本次分析未完成，请稍后重试或使用示例文件。"; return NextResponse.json({ message }, { status: 422 }); }
}
