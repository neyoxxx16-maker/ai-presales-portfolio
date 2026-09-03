import { NextResponse } from "next/server";
import { processTeaTurn } from "@/lib/tea-conversation";
import { enhanceWithLiveRag } from "@/lib/rag/pipeline";
import { embedTexts, embeddingProviderStatus } from "@/lib/rag/embedding-provider";
import { loadTeaVectorIndex } from "@/lib/rag/vector-store";
import type { TeaConversationContext, TeaConversationState } from "@/types/tea";

export const runtime = "nodejs";

// 仅预热本地常驻 Worker。Remote Embedding 不在模块加载时产生静默、无用户请求的调用。
void loadTeaVectorIndex().catch(() => undefined);
if (embeddingProviderStatus().provider === "local") void embedTexts(["一叶春山知识库预热"]).catch(() => undefined);

export async function POST(request: Request) {
  const startedAt = performance.now();
  const timings: Record<string, number> = {};
  try {
    const body = await request.json() as { question?: string; conversationState?: TeaConversationState; conversationContext?: TeaConversationContext };
    timings.receive = performance.now() - startedAt;
    const question = body.question?.trim();
    if (!question) return NextResponse.json({ error: "invalid_question" }, { status: 400 });
    const conversationContext = body.conversationContext ? {
      priorUserQueries: body.conversationContext.priorUserQueries?.slice(-6),
      priorAnswers: body.conversationContext.priorAnswers?.slice(-6),
    } : undefined;
    const intentStartedAt = performance.now();
    const turn = processTeaTurn(question, body.conversationState, conversationContext);
    timings.intentAndRules = performance.now() - intentStartedAt;
    const ragStartedAt = performance.now();
    const answer = await enhanceWithLiveRag(question, turn);
    timings.ragAndGeneration = performance.now() - ragStartedAt;
    timings.total = performance.now() - startedAt;
    if (process.env.NODE_ENV !== "production") {
      console.info("[Tea Assistant Performance]", Object.fromEntries(Object.entries(timings).map(([name, value]) => [name, `${Math.round(value)}ms`])));
    }
    return NextResponse.json({ answer, state: turn.state, intent: turn.intent });
  } catch {
    if (process.env.NODE_ENV !== "production") console.info("[Tea Assistant Performance]", { failedAfter: `${Math.round(performance.now() - startedAt)}ms` });
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }
}
