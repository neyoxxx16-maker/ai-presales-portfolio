import { NextResponse } from "next/server";
import { processTeaTurn } from "@/lib/tea-conversation";
import { enhanceWithLiveRag } from "@/lib/rag/pipeline";
import type { TeaConversationContext, TeaConversationState } from "@/types/tea";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { question?: string; conversationState?: TeaConversationState; conversationContext?: TeaConversationContext };
    const question = body.question?.trim();
    if (!question) return NextResponse.json({ error: "invalid_question" }, { status: 400 });
    const conversationContext = body.conversationContext ? {
      priorUserQueries: body.conversationContext.priorUserQueries?.slice(-6),
      priorAnswers: body.conversationContext.priorAnswers?.slice(-6),
    } : undefined;
    const turn = processTeaTurn(question, body.conversationState, conversationContext);
    const answer = await enhanceWithLiveRag(question, turn);
    return NextResponse.json({ answer, state: turn.state, intent: turn.intent });
  } catch {
    return NextResponse.json({ error: "request_failed" }, { status: 500 });
  }
}
