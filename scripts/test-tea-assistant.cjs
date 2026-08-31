const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveTeaAlias(request, parent, isMain, options) {
  const target = request.startsWith("@/") ? path.join(projectRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, target, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  module._compile(output.outputText, filename);
};

const { buildTeaAnswer } = require("../lib/tea-response.ts");
const { classifyTeaIntent } = require("../lib/tea-intent.ts");
const { teaPriceEvidence } = require("../data/tea/products.ts");

const cases = [
  { question: "明前龙井试饮装多少克？", contains: ["3g × 2袋", "共6g"] },
  { question: "明前龙井试饮装多少钱？", contains: ["¥9.9", "包邮"], sourceTypesPresent: ["sku"] },
  { question: "明前龙井单罐多少克？", contains: ["60g"] },
  { question: "桂花龙井单罐多少钱？", contains: ["¥109", "¥119"] },
  { question: "明前龙井和梅枞天红双拼多少钱？", contains: ["共150g", "¥298"] },
  { question: "桂花龙井和桂花红茶双拼多少钱？", contains: ["共150g", "¥418"] },
  { question: "梅枞天红是什么？", contains: ["龙井红茶", "别名"] },
  { question: "龙井红茶和梅枞天红是两款茶吗？", contains: ["不是两款不同的茶", "同一茶品"] },
  { question: "桂花红茶适合什么人？", contains: ["桂花甜香", "红茶暖香", "顺滑"], intent: "product_fit", sourceTypesPresent: ["tea_type"], sourceTypesAbsent: ["brewing"] },
  { question: "明前龙井适合什么口味的人？", contains: ["鲜爽", "栗香", "兰花香"], intent: "product_fit" },
  { question: "我喜欢蜜香醇厚，适合什么？", contains: ["龙井红茶", "蜜香", "醇厚"], intent: "product_fit" },
  { question: "我喜欢花香，但是不想太厚重。", contains: ["桂花龙井", "桂花甜香"], intent: "product_fit" },
  { question: "你们有哪些适合送礼的产品？", contains: ["送礼礼盒"], intent: "gift_catalog", skuIds: ["longjing-black-tea-duo", "osmanthus-duo-gift"], sourceTypesPresent: ["sku", "recommendation"] },
  { question: "有哪些礼盒？", contains: ["送礼礼盒"], intent: "gift_catalog", skuIds: ["longjing-black-tea-duo", "osmanthus-duo-gift"] },
  { question: "有什么500元以内的礼盒？", contains: ["¥500", "价格已明确"], intent: "gift_catalog", skuIds: ["longjing-black-tea-duo", "osmanthus-duo-gift"] },
  { question: "预算500元，想送长辈，喜欢清香一点，有什么推荐？", contains: ["¥298", "¥418"], intent: "product_recommendation", skuIds: ["longjing-black-tea-duo", "osmanthus-duo-gift"], sourceTypesPresent: ["recommendation", "sku"], absent: ["请再补充至少两项"] },
  { question: "预算300，送人，喜欢鲜爽一点。", contains: ["¥298"], intent: "product_recommendation", skuIds: ["longjing-black-tea-duo"] },
  { question: "预算450，喜欢桂花香，送朋友。", contains: ["¥418"], intent: "product_recommendation", skuIds: ["osmanthus-duo-gift"] },
  { question: "我想自己喝，喜欢蜜香，预算150。", contains: ["龙井红茶单罐", "¥109"], intent: "product_recommendation", skuIds: ["longjing-black-tea-single-60g"] },
  { question: "给我推荐一款茶。", contains: ["主要是自己喝还是送礼"], intent: "product_recommendation" },
  { question: "礼盒多少钱？", contains: ["请先确认具体礼盒", "150g双拼", "250g礼盒"], intent: "price_query", absent: ["当前售价 ¥298", "当前售价 ¥418"] },
  { question: "红茶礼盒多少钱？", contains: ["请先确认具体礼盒"], intent: "price_query" },
  { question: "龙井红茶250g礼盒多少钱？", contains: ["¥288", "¥298", "销售页面价格"], intent: "price_query", sourceTypesPresent: ["sku"], absent: ["当前售价 ¥298"] },
  { question: "桂花红茶250g礼盒多少钱？", contains: ["¥408", "¥418", "销售页面价格"], intent: "price_query" },
  { question: "一叶春山所有茶都是西湖龙井吗？", contains: ["不是", "不代表所有线上商品"], intent: "brand_question", sourceTypesPresent: ["brand_profile"] },
  { question: "高端西湖龙井可以网上买吗？", contains: ["仅线下销售"], intent: "brand_question" },
  { question: "龙井红茶保质期到底18个月还是24个月？", contains: ["18个月", "24个月", "具体 SKU" ] },
  { question: "桂花红茶能治失眠吗？", contains: ["不能", "医疗功效" ] },
  { question: "帮我查别人的订单地址。", contains: ["不能查询", "隐私信息" ] },
  { question: "你们有铁观音吗？", contains: ["没有可以支持", "不会根据缺失资料" ] },
];

let passed = 0;
for (const testCase of cases) {
  const intent = classifyTeaIntent(testCase.question).intent;
  const result = buildTeaAnswer(testCase.question);
  const recommendationFacts = (result.recommendationSkus ?? []).flatMap((sku) => {
    const prices = teaPriceEvidence.filter((price) => sku.priceEvidenceIds?.includes(price.id));
    return [`${sku.name} ${sku.spec} ${sku.netContent}`, ...prices.map((price) => `¥${price.amount} ${price.originalPrice ? `¥${price.originalPrice}` : ""}`)];
  }).join(" ");
  const responseFacts = `${result.answer} ${recommendationFacts}`;
  for (const text of testCase.contains) assert.ok(responseFacts.includes(text), `${testCase.question} should include: ${text}`);
  for (const text of testCase.absent ?? []) assert.ok(!result.answer.includes(text), `${testCase.question} should not include: ${text}`);
  if (testCase.intent) assert.equal(intent, testCase.intent, `${testCase.question} intent`);
  for (const skuId of testCase.skuIds ?? []) assert.ok((result.recommendationSkus ?? []).some((sku) => sku.id === skuId), `${testCase.question} should recommend: ${skuId}`);
  for (const type of testCase.sourceTypesPresent ?? []) assert.ok(result.sources.some((source) => source.knowledgeType === type), `${testCase.question} should cite: ${type}`);
  for (const type of testCase.sourceTypesAbsent ?? []) assert.ok(!result.sources.some((source) => source.knowledgeType === type), `${testCase.question} should not cite: ${type}`);
  assert.ok(!(result.recommendationSkus ?? []).some((sku) => /unresolved|placeholder|mock/.test(sku.id)), `${testCase.question} must not expose an internal placeholder SKU`);
  assert.ok(!/用户本人确认|用户补充说明|user_confirmed|user_confirmed_business_rule/.test(result.answer), `${testCase.question} must not expose internal provenance`);
  passed += 1;
}

console.log(`Tea assistant regression: ${passed}/${cases.length} passed`);
