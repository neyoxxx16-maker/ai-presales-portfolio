import { NextResponse } from "next/server";
import { EcommerceAgentError, isEcommerceAgentResult, runEcommerceAgent } from "@/lib/ecommerce-agent/orchestrator";
import { getProductFacts } from "@/lib/ecommerce-agent/tools";
import { teaSkus } from "@/data/tea/products";
import type { EcommerceAgentRequest } from "@/types/ecommerce-agent";

export const runtime = "nodejs";

const errorMessages = {
  invalid_request: "请先选择商品和内容任务，并检查补充要求是否过长。",
  product_not_found: "未找到所选商品，请重新选择后再试。",
  provider_unavailable: "内容生成服务尚未配置，暂时无法执行 Agent。",
  provider_timeout: "内容生成服务响应超时，请稍后重新生成。",
  provider_failed: "内容生成服务暂时不可用，请稍后重试。",
  provider_malformed: "内容生成结果格式异常，未采用本次内容，请重新生成。",
  tool_failed: "Agent 未能完成商品事实校验，未采用本次内容，请重新生成。",
} as const;

export async function GET() {
  return NextResponse.json({ products: teaSkus.map((sku) => {
    const facts = getProductFacts(sku.id);
    return facts ? { skuId: facts.skuId, skuName: facts.skuName, specification: facts.specification, netContent: facts.netContent, packaging: facts.packaging, price: facts.price } : null;
  }).filter(Boolean) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as EcommerceAgentRequest;
    const result = await runEcommerceAgent(body);
    if (!isEcommerceAgentResult(result)) return NextResponse.json({ error: "provider_malformed", message: errorMessages.provider_malformed }, { status: 502 });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof EcommerceAgentError ? error.code : "provider_failed";
    const status = code === "invalid_request" ? 400 : code === "product_not_found" ? 404 : code === "provider_unavailable" ? 503 : 502;
    return NextResponse.json({ error: code, message: errorMessages[code] }, { status });
  }
}
