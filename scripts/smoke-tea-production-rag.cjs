const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(projectRoot, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
}
process.env.NODE_ENV = "production";
process.env.EMBEDDING_PROVIDER = "openai-compatible";
process.env.EMBEDDING_MODEL = "text-embedding-v4";
process.env.EMBEDDING_DIMENSIONS = "512";

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveTeaAlias(request, parent, isMain, options) { return originalResolveFilename.call(this, request.startsWith("@/") ? path.join(projectRoot, request.slice(2)) : request, parent, isMain, options); };
require.extensions[".ts"] = function compileTypeScript(module, filename) { const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }); module._compile(output.outputText, filename); };

const { embeddingProviderStatus } = require("../lib/rag/embedding-provider.ts");
const { loadTeaVectorIndex } = require("../lib/rag/vector-store.ts");
const { enhanceWithLiveRag } = require("../lib/rag/pipeline.ts");
const { processTeaTurn } = require("../lib/tea-conversation.ts");

async function main() {
  const provider = embeddingProviderStatus();
  assert.deepEqual(provider, { enabled: true, provider: "openai-compatible", model: "text-embedding-v4", dimensions: 512 }, "Production remote embedding must be completely configured");
  assert.ok(process.env.DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY is required for the live RAG smoke test");
  const index = await loadTeaVectorIndex();
  assert.ok(index?.model === "text-embedding-v4" && index.dimensions === 512 && index.chunks.length === 11 && index.chunks.every((chunk) => chunk.embedding.length === 512), "Production 512d index must be complete");
  for (const question of ["桂花红茶适合什么人？", "预算500元，送长辈，喜欢清香一点，有什么推荐？", "龙井应该怎么冲泡？"]) {
    const result = await enhanceWithLiveRag(question, processTeaTurn(question));
    assert.equal(result.mode, "live-rag", `${question}: live Hybrid RAG must complete (${result.ragStatus ?? "no_status"}: ${result.ragError ?? "no_error"})`);
    assert.equal(result.ragStatus, "HYBRID_RAG_ACTIVE", `${question}: keyword + vector + RRF must be active`);
    assert.ok(result.sources.length > 0, `${question}: final answer must retain hybrid-retrieved references`);
    assert.ok(["关键词检索", "向量检索", "Hybrid / RRF 融合"].every((label) => result.execution.some((step) => step.label === label && step.status === "completed")), `${question}: execution trace must expose all retrieval stages`);
  }
  console.log("Tea Production Hybrid RAG smoke: 3/3 passed");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "production_rag_smoke_failed"); process.exitCode = 1; });
