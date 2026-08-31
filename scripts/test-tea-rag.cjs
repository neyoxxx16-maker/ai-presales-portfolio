const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveTeaAlias(request, parent, isMain, options) { return originalResolveFilename.call(this, request.startsWith("@/") ? path.join(projectRoot, request.slice(2)) : request, parent, isMain, options); };
require.extensions[".ts"] = function compileTypeScript(module, filename) { const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }); module._compile(output.outputText, filename); };

const { cosineSimilarity, searchTeaVectorIndex } = require("../lib/rag/vector-store.ts");
const { validateGroundedOutput } = require("../lib/rag/pipeline.ts");
const { buildTeaAnswer } = require("../lib/tea-response.ts");

const index = { version: 1, model: "test", dimensions: 2, chunks: [
  { id: "KB005", title: "桂花红茶", content: "桂花红茶适合偏好桂花甜香与红茶暖香的人", category: "tea_type", sourceIds: ["S01"], productIds: ["osmanthus-black-tea"], tags: ["桂花红茶"], embedding: [0.95, 0.1] },
  { id: "KB007", title: "冲泡指南", content: "红茶冲泡使用95-100℃", category: "brewing", sourceIds: ["S02"], productIds: ["osmanthus-black-tea"], tags: ["冲泡"], embedding: [1, 0] },
] };
assert.equal(cosineSimilarity([1, 0], [1, 0]), 1, "cosine similarity must be real");
assert.equal(searchTeaVectorIndex(index, [1, 0], { productIds: ["osmanthus-black-tea"], categories: ["brewing"] }).hits[0].id, "KB007", "brewing retrieval should prefer brewing knowledge");
assert.equal(searchTeaVectorIndex(index, [0.95, 0.1], { productIds: ["osmanthus-black-tea"], categories: ["tea_type"] }).hits[0].id, "KB005", "fit retrieval should avoid brewing as primary source");
assert.equal(validateGroundedOutput({ answer: "售价 ¥119", citations: ["KB005"], confidence: "high" }, { query: "桂花龙井单罐多少钱", intent: "price_query", structuredFacts: ["桂花龙井单罐｜60g｜售价 ¥109"], allowedCitationIds: ["KB005"] }), undefined, "validator must reject an incorrect structured price");
assert.ok(buildTeaAnswer("你们有铁观音吗？").answer.includes("没有可以支持"), "unknown product must remain grounded");
assert.ok(buildTeaAnswer("桂花红茶能治失眠吗？").answer.includes("不能"), "medical safety must remain deterministic");
console.log("Tea RAG regression: 6/6 passed");
