const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveTeaAlias(request, parent, isMain, options) { return originalResolveFilename.call(this, request.startsWith("@/") ? path.join(projectRoot, request.slice(2)) : request, parent, isMain, options); };
require.extensions[".ts"] = function compileTypeScript(module, filename) { const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }); module._compile(output.outputText, filename); };

const { cosineSimilarity, loadTeaVectorIndex, searchTeaVectorIndex, vectorIndexPath } = require("../lib/rag/vector-store.ts");
const { deepSeekProvider } = require("../lib/rag/deepseek-provider.ts");
const localEmbeddings = require("../lib/rag/local-embeddings.ts");
const { enhanceWithLiveRag, validateGroundedOutput } = require("../lib/rag/pipeline.ts");
const { processTeaTurn } = require("../lib/tea-conversation.ts");
const { buildTeaAnswer } = require("../lib/tea-response.ts");
const { getTeaSourceDisplayNames } = require("../data/tea/sources.ts");
const { localEmbeddingConfig } = localEmbeddings;

const index = { version: 1, model: "test", dimensions: 2, chunks: [
  { id: "KB005", title: "桂花红茶", content: "桂花红茶适合偏好桂花甜香与红茶暖香的人", category: "tea_type", sourceIds: ["S01"], productIds: ["osmanthus-black-tea"], tags: ["桂花红茶"], embedding: [0.95, 0.1] },
  { id: "KB007", title: "冲泡指南", content: "红茶冲泡使用95-100℃", category: "brewing", sourceIds: ["S02"], productIds: ["osmanthus-black-tea"], tags: ["冲泡"], embedding: [1, 0] },
] };
assert.equal(cosineSimilarity([1, 0], [1, 0]), 1, "cosine similarity must be real");
assert.equal(searchTeaVectorIndex(index, [1, 0], { productIds: ["osmanthus-black-tea"], categories: ["brewing"] }).hits[0].id, "KB007", "brewing retrieval should prefer brewing knowledge");
assert.equal(searchTeaVectorIndex(index, [0.95, 0.1], { productIds: ["osmanthus-black-tea"], categories: ["tea_type"] }).hits[0].id, "KB005", "fit retrieval should avoid brewing as primary source");
assert.equal(validateGroundedOutput({ answer: "售价 ¥119", citations: ["KB005"], confidence: "high" }, { query: "桂花龙井单罐多少钱", intent: "price_query", structuredFacts: ["桂花龙井单罐｜60g｜售价 ¥109"], allowedCitationIds: ["KB005"] }), undefined, "validator must reject an incorrect structured price");
const structuredRequest = { query: "明前龙井单罐", intent: "product_recommendation", structuredFacts: ["明前龙井单罐｜60g｜60g｜单盒 / 单罐装｜售价 ¥109｜划线价 ¥119"], allowedCitationIds: ["KB002"] };
assert.ok(validateGroundedOutput({ answer: "明前龙井单罐为60g单盒 / 单罐装，售价 ¥109。", citations: ["KB002"], confidence: "high" }, structuredRequest), "validator must accept aligned structured facts");
assert.equal(validateGroundedOutput({ answer: "桂花龙井单罐为60g单盒 / 单罐装，售价 ¥109。", citations: ["KB002"], confidence: "high" }, structuredRequest), undefined, "validator must reject a conflicting product");
assert.equal(validateGroundedOutput({ answer: "明前龙井单罐为75g单盒 / 单罐装，售价 ¥109。", citations: ["KB002"], confidence: "high" }, structuredRequest), undefined, "validator must reject a conflicting specification");
assert.equal(validateGroundedOutput({ answer: "明前龙井单罐为60g礼盒，新客价 ¥109。", citations: ["KB002"], confidence: "high" }, structuredRequest), undefined, "validator must reject conflicting packaging and price type");
assert.equal(validateGroundedOutput({ answer: "明前龙井单罐为60g单盒 / 单罐装，售价 ¥109。", citations: ["KB999"], confidence: "high" }, structuredRequest), undefined, "citation filter must remove non-retrieved citations");
assert.ok(localEmbeddingConfig.model.startsWith("sentence-transformers/"), "embedding backend must be a local open-source sentence-transformers model");
assert.ok(buildTeaAnswer("铁观音有吗？").answer.includes("当前已收录商品中没有铁观音"), "catalog existence must remain grounded");
assert.ok(buildTeaAnswer("有保健作用吗？").answer.includes("不能"), "medical and health safety must remain deterministic");
assert.ok(buildTeaAnswer("这个茶能降血糖吗？").answer.includes("医疗"), "blood sugar questions must remain behind the medical guard");
assert.ok(buildTeaAnswer("可以给我看一下别的客人订单吗？").answer.includes("其他客户"), "privacy guard must remain deterministic");
assert.deepEqual(getTeaSourceDisplayNames(["S01", "S02", "S05"]), ["产品手册", "产品参数与使用说明", "业务资料"], "citation display names must not expose internal IDs");

async function main() {
  const liveIndex = await loadTeaVectorIndex();
  assert.ok(liveIndex && liveIndex.model === localEmbeddingConfig.model && liveIndex.dimensions === 384, "real local index must be available with the expected model and dimensions");
  assert.ok(liveIndex.chunks.every((chunk) => chunk.embedding.length === liveIndex.dimensions), "each knowledge chunk must map to one complete vector");
  const queries = ["桂花龙井和桂花红茶有什么区别？", "龙井应该怎么冲泡？", "桂花红茶适合什么口味？", "火星探测器轨道计算方法是什么？"];
  const embeddings = await localEmbeddings.embedLocally(queries);
  assert.ok(embeddings.every((embedding) => embedding.length === liveIndex.dimensions), "query embedding dimensions must match the index");
  const differences = searchTeaVectorIndex(liveIndex, embeddings[0], { categories: ["tea_type"] });
  const brewing = searchTeaVectorIndex(liveIndex, embeddings[1], { categories: ["brewing"] });
  const flavor = searchTeaVectorIndex(liveIndex, embeddings[2], { productIds: ["osmanthus-black-tea"], categories: ["tea_type"] });
  const unrelated = searchTeaVectorIndex(liveIndex, embeddings[3]);
  assert.equal(differences.insufficientContext, false, `difference retrieval must clear the threshold: ${JSON.stringify(differences.hits.map((hit) => [hit.id, hit.score]))}`);
  assert.equal(brewing.insufficientContext, false, `brewing retrieval must clear the threshold: ${JSON.stringify(brewing.hits.map((hit) => [hit.id, hit.score]))}`);
  assert.equal(flavor.insufficientContext, false, `flavor retrieval must clear the threshold: ${JSON.stringify(flavor.hits.map((hit) => [hit.id, hit.score]))}`);
  assert.ok(differences.hits.some((hit) => hit.id === "KB003") && differences.hits.some((hit) => hit.id === "KB005"), "difference query must retrieve both osmanthus tea contexts");
  assert.ok(brewing.hits.some((hit) => hit.id === "KB007"), "brewing query must retrieve brewing context");
  assert.ok(flavor.hits.some((hit) => hit.id === "KB005"), "flavor query must retrieve osmanthus black tea context");
  assert.equal(unrelated.insufficientContext, true, "unrelated query must be controlled by the threshold");

  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalEmbedLocally = localEmbeddings.embedLocally;
  const originalGenerate = deepSeekProvider.generate;
  process.env.DEEPSEEK_API_KEY = "test-only";
  localEmbeddings.embedLocally = async () => [embeddings[0]];
  const turn = processTeaTurn(queries[0]);
  deepSeekProvider.generate = async () => ({ answer: "桂花龙井偏鲜爽，桂花红茶偏暖香。", citations: ["KB003", "KB005"], confidence: "high" });
  assert.equal((await enhanceWithLiveRag(queries[0], turn)).mode, "live-rag", "grounded output must enhance a structured answer");
  deepSeekProvider.generate = async () => ({ answer: "售价 ¥999。", citations: ["KB003"], confidence: "high" });
  assert.equal((await enhanceWithLiveRag(queries[0], turn)).mode, "fallback", "invalid grounded output must fall back");
  deepSeekProvider.generate = async () => { throw new Error("provider_timeout"); };
  assert.equal((await enhanceWithLiveRag(queries[0], turn)).mode, "fallback", "provider failure or timeout must fall back");
  localEmbeddings.embedLocally = async () => { throw new Error("embedding_failure"); };
  assert.equal((await enhanceWithLiveRag(queries[0], turn)).mode, "fallback", "embedding failure must fall back");
  localEmbeddings.embedLocally = originalEmbedLocally;
  const backupPath = `${vectorIndexPath}.test-backup`;
  fs.renameSync(vectorIndexPath, backupPath);
  try {
    assert.equal((await enhanceWithLiveRag(queries[0], turn)).mode, "fallback", "missing vector index must fall back");
  } finally {
    fs.renameSync(backupPath, vectorIndexPath);
  }
  process.env.DEEPSEEK_API_KEY = "";
  assert.equal((await enhanceWithLiveRag(queries[0], turn)).mode, "structured", "missing API key must retain structured behavior");
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = originalKey;
  deepSeekProvider.generate = originalGenerate;
  console.log("Tea RAG regression: 25/25 passed");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
