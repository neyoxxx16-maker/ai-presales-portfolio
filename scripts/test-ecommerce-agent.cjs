const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) { return originalResolveFilename.call(this, request.startsWith("@/") ? path.join(projectRoot, request.slice(2)) : request, parent, isMain, options); };
require.extensions[".ts"] = function compileTypeScript(module, filename) { const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }); module._compile(output.outputText, filename); };

const { getProductFacts, validateProductClaims, scanContentRisk, finalizeContent } = require("../lib/ecommerce-agent/tools.ts");
const { EcommerceAgentError, isEcommerceAgentResult, runEcommerceAgent } = require("../lib/ecommerce-agent/orchestrator.ts");

async function main() {
  let passed = 0;
  const facts = getProductFacts("mingqian-longjing-single-60g");
  assert.ok(facts, "verified SKU facts should be readable");
  assert.equal(facts.skuName, "明前龙井单罐");
  assert.equal(facts.netContent, "60g");
  assert.equal(facts.price.amount, 109);
  assert.ok(facts.unavailableFields.includes("产区"));
  passed += 1;

  const aligned = "明前龙井单罐，60g 单罐装。栗香与兰花香交织，入口鲜爽回甘，适合午后自饮。";
  assert.equal(validateProductClaims(aligned, facts).passed, true, "aligned facts should pass validation");
  passed += 1;

  const invalid = validateProductClaims("桂花龙井礼盒，75g，售价 ¥298。", facts);
  assert.equal(invalid.passed, false, "wrong product claims should fail validation");
  assert.ok(invalid.issues.some((issue) => issue.field === "商品名"));
  assert.ok(invalid.issues.some((issue) => issue.field === "规格 / 净含量"));
  assert.ok(invalid.issues.some((issue) => issue.field === "包装"));
  assert.ok(invalid.issues.some((issue) => issue.field === "价格"));
  passed += 1;

  assert.equal(scanContentRisk("100%顶级好茶，保证立刻见效。", validateProductClaims("100%顶级好茶，保证立刻见效。", facts)).level, "attention", "absolute claims should trigger attention");
  assert.equal(scanContentRisk("饮用可降血糖。", validateProductClaims("饮用可降血糖。", facts)).level, "block", "medical claims must be blocked");
  passed += 1;

  const mockModel = { complete: async (request) => request.tools[0].function.name === "get_product_facts" ? { role: "assistant", tool_calls: [{ id: "facts-call", type: "function", function: { name: "get_product_facts", arguments: '{"skuId":"mingqian-longjing-single-60g"}' } }] } : { role: "assistant", tool_calls: [{ id: "final-call", type: "function", function: { name: "finalize_content", arguments: JSON.stringify({ candidateContent: aligned }) } }] } };
  const result = await runEcommerceAgent({ skuId: "mingqian-longjing-single-60g", taskType: "selling_points", length: "约100字" }, mockModel);
  assert.equal(result.status, "ready_for_review", "normal agent run should wait for human review");
  assert.equal(result.workflow.length, 5, "agent must expose the full actual workflow");
  assert.ok(isEcommerceAgentResult(result), "agent result should satisfy runtime schema");
  assert.equal(isEcommerceAgentResult({ generatedContent: "only text" }), false, "malformed structured output must be rejected");
  passed += 1;

  const finalized = finalizeContent("明前龙井单罐75g礼盒，售价 ¥298。", facts, "selling_points");
  assert.equal(finalized.status, "blocked", "known parameter errors can never be approved");
  passed += 1;

  await assert.rejects(() => runEcommerceAgent({ skuId: "not-a-real-sku", taskType: "selling_points" }, mockModel), (error) => error instanceof EcommerceAgentError && error.code === "product_not_found");
  await assert.rejects(() => runEcommerceAgent({ skuId: "mingqian-longjing-single-60g", taskType: "selling_points" }, { complete: async () => { throw new EcommerceAgentError("provider_timeout"); } }), (error) => error instanceof EcommerceAgentError && error.code === "provider_timeout");
  passed += 1;

  const clientFiles = ["app/demo/ecommerce-agent/page.tsx", "components/ecommerce-agent/EcommerceAgentWorkspace.tsx"];
  for (const file of clientFiles) assert.equal(/DEEPSEEK_API_KEY|process\.env/.test(fs.readFileSync(path.join(projectRoot, file), "utf8")), false, `${file} must not expose server secrets`);
  passed += 1;

  console.log(`Ecommerce Agent regression: ${passed}/8 passed`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
