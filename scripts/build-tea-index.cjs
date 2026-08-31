const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveTeaAlias(request, parent, isMain, options) { return originalResolveFilename.call(this, request.startsWith("@/") ? path.join(projectRoot, request.slice(2)) : request, parent, isMain, options); };
require.extensions[".ts"] = function compileTypeScript(module, filename) { const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }); module._compile(output.outputText, filename); };

const { createTeaKnowledgeChunks } = require("../lib/rag/chunks.ts");
const { openAIProvider } = require("../lib/rag/providers.ts");
const { vectorIndexPath } = require("../lib/rag/vector-store.ts");

async function main() {
  if (!process.env.LLM_API_KEY) throw new Error("LLM_API_KEY is required to build the live vector index.");
  const chunks = createTeaKnowledgeChunks();
  const embeddings = await openAIProvider.embedMany(chunks.map((chunk) => `${chunk.title}\n${chunk.content}`));
  fs.mkdirSync(path.dirname(vectorIndexPath), { recursive: true });
  fs.writeFileSync(vectorIndexPath, JSON.stringify({ version: 1, model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small", dimensions: embeddings[0]?.length ?? 0, chunks: chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] })) }, null, 2));
  console.log(`Tea vector index: ${chunks.length} chunks, ${embeddings[0]?.length ?? 0} dimensions`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
