const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, isMain, options);
};
require.extensions[".ts"] = function (module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  module._compile(output.outputText, filename);
};

const normalize = (value) => value.toLowerCase().replace(/[\s，。；、：：“”()（）/]/g, "");
const keywordScore = (query, content, tags) => {
  const q = normalize(query); const target = normalize(`${content}${tags.join(" ")}`);
  const tagHits = tags.filter((tag) => q.includes(normalize(tag))).length;
  const cjk = q.match(/[\u4e00-\u9fa5]{2,6}/g) ?? []; const phraseHits = cjk.filter((term) => target.includes(term)).length;
  const ascii = q.match(/[a-z0-9]{2,}/g) ?? [];
  return tagHits * 8 + phraseHits * 2 + ascii.filter((term) => target.includes(term)).length * 4;
};
const cosine = (a, b) => a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0) /
  (Math.sqrt(a.reduce((sum, value) => sum + value * value, 0)) * Math.sqrt(b.reduce((sum, value) => sum + value * value, 0)));
const output = (items, score) => items.slice(0, 3).map((item, index) => ({ rank: index + 1, file: item.chunk.metadata.fileName, score: Number(score(item).toFixed(4)) }));

async function main() {
  const { embeddingProviderStatus, embedTexts } = require("../lib/tender-agent/embedding-provider.ts");
  const { closeLocalEmbeddingWorker } = require("../lib/rag/local-embeddings.ts");
  const { ingestCompanyDocument, deleteCompanyDocument, listCompanyChunks } = require("../lib/tender-agent/company-workspace.ts");
  const { retrieveCompanyEvidence } = require("../lib/tender-agent/company-retriever.ts");
  const status = embeddingProviderStatus(); assert.equal(status.enabled, true, "local embedding must be enabled");
  const query = "供应商是否具备信息安全体系认证资质？";
  const documents = [];
  documents.push(await ingestCompanyDocument(new File(["我司已获得 ISO27001 信息安全管理体系认证，认证有效期至 2027 年。"], "iso27001-qualification.txt", { type: "text/plain" }), "qualification", { validFrom: "2025-01-01", validTo: "2027-12-31", issuer: "认证机构", tags: ["ISO27001", "信息安全"] }));
  documents.push(await ingestCompanyDocument(new File(["企业建立了覆盖研发、交付与运维的数据安全和信息安全管理体系，并通过第三方审核。"], "security-management.txt", { type: "text/plain" }), "qualification", { tags: ["数据安全", "管理体系"] }));
  documents.push(await ingestCompanyDocument(new File(["项目团队拥有多名具备项目管理经验的交付人员，可支持智慧园区项目实施。"], "project-team.txt", { type: "text/plain" }), "personnel", { tags: ["项目团队"] }));
  try {
    const chunks = (await listCompanyChunks()).filter((chunk) => documents.some((document) => document.documentId === chunk.documentId));
    assert.ok(chunks.length >= 3 && chunks.every((chunk) => chunk.embedding?.length), "ingestion must persist document embeddings");
    const [queryEmbedding] = await embedTexts([query]); assert.equal(queryEmbedding.length, chunks[0].embedding.length, "query and document dimensions must match");
    const keyword = chunks.map((chunk) => ({ chunk, score: keywordScore(query, chunk.content, chunk.metadata.tags) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    const vector = chunks.map((chunk) => ({ chunk, score: cosine(queryEmbedding, chunk.embedding) })).filter((item) => item.score > 0.25).sort((a, b) => b.score - a.score);
    const fused = await retrieveCompanyEvidence(query, { topK: 3 });
    assert.ok(keyword.length > 0, "keyword retrieval must return results"); assert.ok(vector.length > 0, "vector retrieval must return results");
    assert.equal(fused.semanticEnabled, true, "semantic retrieval must be active"); assert.equal(fused.fallback, undefined, "HYBRID_RAG_DEGRADED must not appear");
    console.log(JSON.stringify({ model: status.model, dimensions: queryEmbedding.length, query, keywordTopResults: output(keyword, (item) => item.score), vectorTopResults: output(vector, (item) => item.score), rrfFinalResults: fused.results.map((item, index) => ({ rank: index + 1, file: item.sourceFile, retrievalMethod: item.retrievalMethod, score: item.score })), trace: fused.fallback ?? "HYBRID_RAG_ACTIVE" }, null, 2));
  } finally { await Promise.all(documents.map((document) => deleteCompanyDocument(document.documentId))); closeLocalEmbeddingWorker(); }
}
main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
