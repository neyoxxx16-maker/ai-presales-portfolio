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
const { processTeaTurn } = require("../lib/tea-conversation.ts");
const { teaPriceEvidence } = require("../data/tea/products.ts");
const { teaSkus } = require("../data/tea/products.ts");
const { retrieveTeaKnowledge } = require("../lib/tea-retrieval.ts");
const { createTeaKnowledgeChunks } = require("../lib/rag/chunks.ts");

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
  { question: "你们有哪些适合送礼的产品？", contains: ["11 个具体 SKU"], intent: "product_browse", skuIds: ["mingqian-longjing-sample", "longjing-black-tea-duo", "osmanthus-duo-gift"], sourceTypesPresent: ["sku"] },
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
  { question: "有保健作用吗？", contains: ["不能", "保健功效", "风味", "冲泡方式" ], absent: ["没有可以支持"] },
  { question: "桂花红茶能治失眠吗？", contains: ["不能", "医疗", "保健功效" ] },
  { question: "可以给我看一下别的客人订单吗？", contains: ["不能提供", "其他客户", "手机号", "购买记录", "不连接真实订单" ], absent: ["没有可以支持"] },
  { question: "帮我查别人的订单地址。", contains: ["不能提供", "隐私数据" ] },
  { question: "铁观音有吗？", contains: ["当前已收录商品中没有铁观音", "明前龙井", "桂花龙井", "龙井红茶", "桂花红茶" ], intent: "product_existence", absent: ["没有可以支持"] },
  { question: "你们有铁观音吗？", contains: ["当前已收录商品中没有铁观音" ], intent: "product_existence" },
  { question: "298是哪款？", contains: ["明前龙井＋梅枞天红双拼", "共150g", "售价 ¥298", "龙井红茶礼盒", "划线价 ¥298"], intent: "price_reverse_lookup", sourceTypesPresent: ["sku"] },
  { question: "418对应哪些产品？", contains: ["桂花龙井＋桂花红茶双拼", "桂花红茶双盒", "桂花龙井双盒", "桂花红茶礼盒", "划线价 ¥418"], intent: "price_reverse_lookup", sourceTypesPresent: ["sku"] },
  { question: "298和288有什么区别？", contains: ["明前龙井＋梅枞天红双拼", "售价 ¥298", "龙井红茶礼盒", "新客价 ¥288", "划线价 ¥298"], intent: "price_compare", sourceTypesPresent: ["sku"] },
  { question: "418和408有什么区别？", contains: ["桂花龙井＋桂花红茶双拼", "桂花红茶双盒", "桂花龙井双盒", "桂花红茶礼盒", "新客价 ¥408", "划线价 ¥418"], intent: "price_compare", sourceTypesPresent: ["sku"] },
  { question: "最贵的是哪个？", contains: ["最贵", "桂花龙井＋桂花红茶双拼", "桂花红茶双盒", "桂花龙井双盒", "¥418"], intent: "price_extreme", sourceTypesPresent: ["sku"] },
  { question: "最便宜的是哪个？", contains: ["最便宜", "明前龙井试饮装", "共6g", "¥9.9"], intent: "price_extreme", sourceTypesPresent: ["sku"] },
  { question: "最便宜的礼盒是哪款？", contains: ["最便宜", "龙井红茶礼盒", "250g", "新客价 ¥288", "划线价 ¥298"], intent: "price_extreme", sourceTypesPresent: ["sku"] },
  { question: "最贵的礼盒是哪款？", contains: ["最贵", "桂花龙井＋桂花红茶双拼", "桂花红茶双盒", "桂花龙井双盒"], intent: "price_extreme", sourceTypesPresent: ["sku"] },
  { question: "最便宜的单罐是哪款？", contains: ["明前龙井单罐", "龙井红茶单罐", "桂花龙井单罐", "桂花红茶单罐", "¥109"], intent: "price_extreme", sourceTypesPresent: ["sku"] },
  { question: "我只有100块钱，能买什么？", contains: ["预算：¥100", "明前龙井试饮装", "¥9.9"], intent: "product_recommendation", skuIds: ["mingqian-longjing-sample"], sourceTypesPresent: ["recommendation", "sku"] },
  { question: "预算120，只喝绿茶", contains: ["明前龙井试饮装", "明前龙井单罐", "桂花龙井单罐"], intent: "product_recommendation", skuIds: ["mingqian-longjing-sample", "mingqian-longjing-single-60g", "osmanthus-longjing-single-60g"], absentSkuIds: ["longjing-black-tea-single-60g", "osmanthus-black-tea-single-60g"] },
  { question: "不喜欢桂花，200以内", contains: ["明前龙井试饮装", "明前龙井单罐"], intent: "product_recommendation", skuIds: ["mingqian-longjing-sample", "mingqian-longjing-single-60g"], absentSkuIds: ["osmanthus-longjing-single-60g", "osmanthus-black-tea-single-60g", "osmanthus-duo-gift"] },
  { question: "我不喜欢红茶，预算500送礼", contains: ["桂花龙井双盒", "¥418"], intent: "product_recommendation", skuIds: ["osmanthus-longjing-double-box"], absentSkuIds: ["longjing-black-tea-duo", "osmanthus-duo-gift", "osmanthus-black-tea-double-box"] },
  { question: "我只要红茶，100元以内", contains: ["没有完全符合"], intent: "product_recommendation", absentSkuIds: ["mingqian-longjing-sample", "mingqian-longjing-single-60g", "osmanthus-longjing-single-60g"] },
  { question: "桂花龙井和桂花红茶有什么区别？", contains: ["调味绿茶", "桂花甜香", "调味红茶", "红茶暖香"], intent: "product_compare", sourceTypesPresent: ["tea_type"], sourceTypesAbsent: ["sku"] },
  { question: "桂花红茶和桂花龙井哪个更清爽？", contains: ["更推荐桂花龙井", "入口更鲜爽、轻快", "桂花红茶则以桂花鲜灵清甜和红茶暖香为主"], intent: "product_compare", sourceTypesPresent: ["tea_type"] },
  { question: "500能买两盒吗？", contains: ["可以帮你算", "哪款商品", "单盒价格"], absent: ["以下商品更匹配"], intent: "quantity_price_calc", entities: { quantity: 2, budget: 500, quantityPriceStatus: "missing_unit_price_or_product" }, absentSkuIds: ["mingqian-longjing-sample", "mingqian-longjing-single-60g", "osmanthus-longjing-single-60g"] },
  { question: "500块可以买两盒298的吗？", contains: ["2 盒共 ¥596", "超过 ¥500 预算 ¥96", "最多可以买 1 盒"], intent: "quantity_price_calc", entities: { quantity: 2, unitPrice: 298, budget: 500, quantityPriceStatus: "complete" }, sourceTypesPresent: ["sku"] },
  { question: "600块可以买两盒298的吗？", contains: ["可以", "2 盒共 ¥596", "剩余 ¥4"], intent: "quantity_price_calc", entities: { quantity: 2, unitPrice: 298, budget: 600, quantityPriceStatus: "complete" }, sourceTypesPresent: ["sku"] },
  { question: "500能买几个298的？", contains: ["最多可以买 1 个 ¥298 的商品", "剩余 ¥202"], intent: "quantity_price_calc", entities: { quantityMode: "maximum", unitPrice: 298, budget: 500, quantityPriceStatus: "complete" } },
  { question: "298的买两盒多少钱？", contains: ["2 盒共 ¥596"], intent: "quantity_price_calc", entities: { quantity: 2, unitPrice: 298, quantityPriceStatus: "complete" } },
  { question: "109一盒，500可以买几盒？", contains: ["最多可以买 4 个 ¥109 的商品", "剩余 ¥64"], intent: "quantity_price_calc", entities: { quantityMode: "maximum", unitPrice: 109, budget: 500, quantityPriceStatus: "complete" } },
  { question: "418对应哪些产品？最便宜的礼盒是哪款？", contains: ["桂花龙井＋桂花红茶双拼", "桂花红茶双盒", "桂花龙井双盒", "桂花红茶礼盒", "最便宜", "龙井红茶礼盒", "新客价 ¥288"] },
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
  for (const [key, value] of Object.entries(testCase.entities ?? {})) assert.equal(classifyTeaIntent(testCase.question).entities[key], value, `${testCase.question} entity ${key}`);
  for (const skuId of testCase.skuIds ?? []) assert.ok((result.recommendationSkus ?? []).some((sku) => sku.id === skuId), `${testCase.question} should recommend: ${skuId}`);
  for (const skuId of testCase.absentSkuIds ?? []) assert.ok(!(result.recommendationSkus ?? []).some((sku) => sku.id === skuId), `${testCase.question} must not recommend: ${skuId}`);
  for (const type of testCase.sourceTypesPresent ?? []) assert.ok(result.sources.some((source) => source.knowledgeType === type), `${testCase.question} should cite: ${type}`);
  for (const type of testCase.sourceTypesAbsent ?? []) assert.ok(!result.sources.some((source) => source.knowledgeType === type), `${testCase.question} should not cite: ${type}`);
  assert.ok(!(result.recommendationSkus ?? []).some((sku) => /unresolved|placeholder|mock/.test(sku.id)), `${testCase.question} must not expose an internal placeholder SKU`);
  assert.ok(!/用户本人确认|用户补充说明|user_confirmed|user_confirmed_business_rule/.test(result.answer), `${testCase.question} must not expose internal provenance`);
  passed += 1;
}

const contextualQuantityAnswer = buildTeaAnswer("500能买两盒吗？", { priorUserQueries: ["298是哪款？"] });
assert.ok(contextualQuantityAnswer.answer.includes("上一轮提到的 ¥298"), "contextual quantity question should resolve the preceding price");
assert.ok(contextualQuantityAnswer.answer.includes("2 盒共 ¥596"), "contextual quantity question should calculate the total");
assert.ok(contextualQuantityAnswer.execution.some((step) => step.detail?.includes("上轮上下文")), "contextual quantity question should report its reference source");
passed += 1;

const quantityIntentPhrases = ["500可以买两盒吗？", "500块够买两盒吗？", "500预算买两个够吗？", "两盒多少钱？", "买三盒要多少钱？", "刚才那个买两个多少钱？", "那款两盒够500吗？"];
for (const question of quantityIntentPhrases) {
  assert.equal(classifyTeaIntent(question).intent, "quantity_price_calc", `${question} should be quantity_price_calc`);
  passed += 1;
}

let quantityDialogState = {};
const quantityTurn1 = processTeaTurn("500能买两盒吗？", quantityDialogState);
quantityDialogState = quantityTurn1.state;
assert.equal(quantityTurn1.intent, "quantity_price_calc", "first quantity turn intent");
assert.equal(quantityDialogState.pendingDialog?.slots.budget, 500, "pending quantity budget");
assert.equal(quantityDialogState.pendingDialog?.slots.quantity, 2, "pending quantity");
assert.deepEqual(quantityDialogState.pendingDialog?.missingSlots, ["product_or_unit_price"], "pending missing slot");
const quantityTurn2 = processTeaTurn("明前龙井", quantityDialogState);
quantityDialogState = quantityTurn2.state;
assert.equal(quantityTurn2.intent, "quantity_price_calc", "product slot should continue quantity dialog");
assert.ok(quantityTurn2.answer.answer.includes("明前龙井有不同规格"), "ambiguous product should ask for a specification");
assert.ok(quantityDialogState.pendingDialog, "ambiguous product should keep the dialog pending");
const quantityTurn3 = processTeaTurn("60g那个", quantityDialogState);
assert.equal(quantityTurn3.intent, "quantity_price_calc", "specification should complete quantity dialog");
assert.ok(quantityTurn3.answer.answer.includes("明前龙井单罐"), "selected SKU should be named");
assert.ok(quantityTurn3.answer.answer.includes("¥218"), "selected SKU total");
assert.ok(quantityTurn3.answer.answer.includes("剩余 ¥282"), "selected SKU remainder");
assert.equal(quantityTurn3.state.pendingDialog, undefined, "completed quantity dialog should clear pending state");
passed += 1;

let browseThenSpecificationState = processTeaTurn("500能买两盒吗？").state;
const browseThenSpecificationTurn2 = processTeaTurn("有哪些", browseThenSpecificationState);
browseThenSpecificationState = browseThenSpecificationTurn2.state;
assert.equal(browseThenSpecificationState.pendingDialog?.slots.budget, 500, "candidate browse should preserve pending budget");
assert.equal(browseThenSpecificationState.pendingDialog?.slots.quantity, 2, "candidate browse should preserve pending quantity");
assert.equal(browseThenSpecificationState.pendingDialog?.slots.productId, undefined, "candidate browse should not guess a product");
assert.equal(browseThenSpecificationState.pendingDialog?.slots.specification, undefined, "candidate browse should not set a specification");
const browseThenSpecificationTurn3 = processTeaTurn("60g的", browseThenSpecificationState);
browseThenSpecificationState = browseThenSpecificationTurn3.state;
assert.equal(browseThenSpecificationTurn3.intent, "quantity_price_calc", "specification-only follow-up should continue quantity dialog");
assert.ok(browseThenSpecificationTurn3.answer.answer.includes("目前 60g 单罐有明前龙井、龙井红茶、桂花龙井和桂花红茶，你想要哪一款？"), "ambiguous 60g specification should ask for a product");
assert.equal(browseThenSpecificationState.pendingDialog?.slots.specification, "60g", "60g should fill the specification slot");
assert.equal(browseThenSpecificationState.pendingDialog?.slots.productId, undefined, "ambiguous 60g specification must not guess a product");
const browseThenSpecificationTurn4 = processTeaTurn("明前龙井", browseThenSpecificationState);
assert.equal(browseThenSpecificationTurn4.intent, "quantity_price_calc", "product follow-up should complete the quantity dialog");
assert.ok(browseThenSpecificationTurn4.answer.answer.includes("¥218"), "60g product selection total");
assert.ok(browseThenSpecificationTurn4.answer.answer.includes("剩余 ¥282"), "60g product selection remainder");
assert.equal(browseThenSpecificationTurn4.state.pendingDialog, undefined, "completed browse/specification dialog should clear pending state");
passed += 1;

let directPriceState = processTeaTurn("500能买两盒吗？").state;
const directPriceTurn = processTeaTurn("298的", directPriceState);
assert.equal(directPriceTurn.intent, "quantity_price_calc", "price-only follow-up should continue quantity dialog");
assert.ok(directPriceTurn.answer.answer.includes("2 盒共 ¥596"), "price-only follow-up total");
assert.ok(directPriceTurn.answer.answer.includes("超过 ¥500 预算 ¥96"), "price-only follow-up over budget");
assert.equal(directPriceTurn.state.pendingDialog, undefined, "price-only follow-up should clear pending state");
passed += 1;

let productOnlyState = processTeaTurn("两盒多少钱？").state;
const productOnlyTurn = processTeaTurn("桂花红茶", productOnlyState);
assert.equal(productOnlyTurn.intent, "quantity_price_calc", "ambiguous product should not become a product question");
assert.ok(productOnlyTurn.answer.answer.includes("桂花红茶有不同规格"), "ambiguous product should request a specification");
assert.ok(productOnlyTurn.state.pendingDialog, "ambiguous product should remain pending");
passed += 1;

let cancelledState = processTeaTurn("500能买两盒吗？").state;
const cancelledTurn = processTeaTurn("算了，桂花红茶怎么泡？", cancelledState);
assert.equal(cancelledTurn.intent, "brewing_question", "explicit new topic should cancel pending quantity dialog");
assert.equal(cancelledTurn.state.pendingDialog, undefined, "new topic should clear pending dialog");
assert.ok(cancelledTurn.answer.answer.includes("95-100℃"), "new brewing question should be answered");
passed += 1;

const inheritedPriceTurn = processTeaTurn("500能买两盒吗？", {}, { priorUserQueries: ["298是哪款？"] });
assert.ok(inheritedPriceTurn.answer.answer.includes("2 盒共 ¥596"), "history price should complete the quantity calculation");
assert.equal(inheritedPriceTurn.state.pendingDialog, undefined, "completed history calculation must not create a pending dialog");
passed += 1;

let recommendationState = processTeaTurn("预算500，只要绿茶，有什么推荐？").state;
const recommendationFollowUp = processTeaTurn("不要桂花", recommendationState);
assert.equal(recommendationFollowUp.intent, "product_recommendation", "recommendation constraint should continue the prior recommendation");
assert.ok(!(recommendationFollowUp.answer.recommendationSkus ?? []).some((sku) => sku.productIds.includes("osmanthus-longjing")), "recommendation follow-up should exclude osmanthus products");
passed += 1;

let priceCandidatesState = processTeaTurn("418对应哪些产品？").state;
const priceCandidatesFollowUp = processTeaTurn("哪个更适合送人？", priceCandidatesState);
assert.equal(priceCandidatesFollowUp.intent, "product_fit", "which-product follow-up should use prior candidates");
assert.ok(priceCandidatesFollowUp.answer.answer.includes("上一轮对应的候选"), "which-product follow-up should reference the prior candidate set");
passed += 1;

const osmanthusDuo = buildTeaAnswer("双拼桂花礼盒里分别是什么茶？");
assert.ok(osmanthusDuo.answer.includes("桂花龙井") && osmanthusDuo.answer.includes("桂花红茶"), "osmanthus duo must answer the structured tea composition");
assert.ok(osmanthusDuo.answer.includes("75g + 75g") && osmanthusDuo.answer.includes("共150g") && osmanthusDuo.answer.includes("¥418"), "osmanthus duo must preserve its confirmed specification and price");
passed += 1;

const giftNetContent = buildTeaAnswer("一叶春山礼盒的净含量是多少？");
assert.ok(giftNetContent.answer.includes("明前龙井＋梅枞天红双拼：75g + 75g，共150g"), "gift net content must list confirmed 150g duo details");
assert.ok(giftNetContent.answer.includes("龙井红茶礼盒：250g") && giftNetContent.answer.includes("桂花红茶礼盒：250g"), "gift net content must retain confirmed 250g sales-page records");
assert.ok(giftNetContent.answer.includes("60g对应") && giftNetContent.answer.includes("不是礼盒规格"), "60g must not be applied to gift boxes");
passed += 1;

const longjingBrewing = buildTeaAnswer("龙井应该怎么冲泡？");
assert.ok(longjingBrewing.answer.includes("90-100℃"), "longjing brewing must use the confirmed KB007 temperature range");
assert.deepEqual(longjingBrewing.sources.map((source) => source.id), ["KB007"], "longjing brewing must cite only the confirmed brewing record");
passed += 1;

const giftCatalogTurn = processTeaTurn("一叶春山有哪些礼盒选择？");
const ordinalStateTurn = processTeaTurn("第二种里面是什么？", giftCatalogTurn.state);
assert.ok(ordinalStateTurn.answer.answer.includes("桂花龙井") && ordinalStateTurn.answer.answer.includes("桂花红茶"), "ordinal follow-up must resolve the second gift from state");
const ordinalContextTurn = processTeaTurn("第二种里面是什么？", {}, { priorUserQueries: ["一叶春山有哪些礼盒选择？"], priorAnswers: [giftCatalogTurn.answer] });
assert.ok(ordinalContextTurn.answer.answer.includes("桂花龙井") && ordinalContextTurn.answer.answer.includes("桂花红茶"), "ordinal follow-up must resolve from request-scoped history");
const isolatedTurn = processTeaTurn("第二种里面是什么？", {}, { priorUserQueries: [], priorAnswers: [] });
assert.ok(!isolatedTurn.answer.answer.includes("桂花龙井＋桂花红茶双拼"), "request-scoped history must not leak between users");
passed += 1;

// SKU Source of Truth + deterministic recommendation routing. These rows deliberately
// exercise catalog aggregation separately from semantic RAG: an answer can count and
// filter confirmed structured records without requiring a single prose chunk to state it.
const skuRoutingCases = [
  { question: "一共有多少产品？", expectedCount: 11, mustInclude: ["11 个具体 SKU"], topSkuId: "mingqian-longjing-sample" },
  { question: "把所有产品列出来", expectedCount: 11, topSkuId: "mingqian-longjing-sample" },
  { question: "有哪些60g单罐？", expectedCount: 4, requiredSkuIds: ["mingqian-longjing-single-60g", "longjing-black-tea-single-60g", "osmanthus-longjing-single-60g", "osmanthus-black-tea-single-60g"] },
  { question: "有哪些150g礼盒？", expectedCount: 4, requiredSkuIds: ["longjing-black-tea-duo", "osmanthus-duo-gift", "osmanthus-black-tea-double-box", "osmanthus-longjing-double-box"] },
  { question: "有哪些250g礼盒？", expectedCount: 2, requiredSkuIds: ["longjing-black-tea-gift-250g", "osmanthus-black-tea-gift-250g"] },
  { question: "有多少款龙井相关商品？", expectedCount: 8 },
  { question: "有哪些红茶？", expectedCount: 7, requiredSkuIds: ["longjing-black-tea-duo", "longjing-black-tea-single-60g", "longjing-black-tea-gift-250g", "osmanthus-black-tea-gift-250g"] },
  { question: "有哪些桂花系列？", expectedCount: 6, requiredSkuIds: ["osmanthus-duo-gift", "osmanthus-black-tea-single-60g", "osmanthus-longjing-double-box"] },
  { question: "我第一次喝，想先尝尝", topSkuId: "mingqian-longjing-sample" },
  { question: "我想买单罐自己喝", expectedCount: 4, requiredSkuIds: ["mingqian-longjing-single-60g", "longjing-black-tea-single-60g", "osmanthus-longjing-single-60g", "osmanthus-black-tea-single-60g"] },
  { question: "我想同时喝绿茶和红茶", topSkuId: "longjing-black-tea-duo" },
  { question: "我喜欢桂花香，想要两种茶", topSkuId: "osmanthus-duo-gift" },
  { question: "我只想喝桂花红茶", topSkuId: "osmanthus-black-tea-single-60g" },
  { question: "我要正式一点的红茶礼盒", topSkuId: "longjing-black-tea-gift-250g" },
  { question: "我要送礼，想选容量更大的", topSkuId: "longjing-black-tea-gift-250g" },
  { question: "预算比较低，有什么推荐？", topSkuId: "mingqian-longjing-sample" },
  { question: "我不喜欢桂花，有什么推荐？", topSkuId: "mingqian-longjing-sample" },
  { question: "我只想买龙井，不要红茶", topSkuId: "mingqian-longjing-sample" },
  { question: "我想买红茶，不要绿茶", topSkuId: "longjing-black-tea-single-60g" },
  { question: "你为什么推荐桂花龙井单罐而不是桂花红茶单罐？", mustInclude: ["桂花龙井", "桂花红茶"], topSkuId: undefined },
];

for (const testCase of skuRoutingCases) {
  const intentResult = classifyTeaIntent(testCase.question);
  const retrieval = retrieveTeaKnowledge(testCase.question, intentResult);
  const result = buildTeaAnswer(testCase.question);
  const skuIds = (result.recommendationSkus ?? []).map((sku) => sku.id);
  if (testCase.expectedCount !== undefined) assert.equal(skuIds.length, testCase.expectedCount, `${testCase.question} should return the complete filtered SKU set`);
  for (const skuId of testCase.requiredSkuIds ?? []) assert.ok(skuIds.includes(skuId), `${testCase.question} should include ${skuId}`);
  if (testCase.topSkuId) assert.equal(skuIds[0], testCase.topSkuId, `${testCase.question} should route to ${testCase.topSkuId} first`);
  for (const text of testCase.mustInclude ?? []) assert.ok(result.answer.includes(text), `${testCase.question} should explain ${text}`);
  assert.ok(!/REQ-|CAP\d|DOC\d|Evidence/.test(result.answer), `${testCase.question} must not leak unrelated internal identifiers`);
  assert.ok(result.sources.length > 0, `${testCase.question} should not trigger insufficient evidence when structured catalog fields exist`);
  console.log(`[SKU routing] ${JSON.stringify({ question: testCase.question, intent: intentResult.intent, constraints: intentResult.entities, retrievedSkuCandidates: retrieval.skus.map((sku) => sku.id), hybridRrfRanking: "structured catalog ranking (hard filters → deterministic score)", finalContext: result.sources.map((source) => source.id), finalRecommendation: skuIds, citations: result.sources.map((source) => source.id), insufficientEvidence: result.sources.length === 0 })}`);
  passed += 1;
}

const skuCoverageScenarios = {
  "mingqian-longjing-sample": "我第一次喝，想先尝尝",
  "mingqian-longjing-single-60g": "我想自己喝，要60g单罐的明前龙井",
  "longjing-black-tea-single-60g": "我想自己喝，要60g单罐的龙井红茶",
  "osmanthus-longjing-single-60g": "我想自己喝，要60g单罐的桂花龙井",
  "osmanthus-black-tea-single-60g": "我想自己喝，要60g单罐的桂花红茶",
  "longjing-black-tea-duo": "我想同时喝绿茶和红茶",
  "osmanthus-duo-gift": "我喜欢桂花香，想要两种茶",
  "osmanthus-black-tea-double-box": "我只要150g双盒的桂花红茶",
  "osmanthus-longjing-double-box": "我只要150g双盒的桂花龙井",
  "longjing-black-tea-gift-250g": "我要250g的正式龙井红茶礼盒",
  "osmanthus-black-tea-gift-250g": "我要250g的正式桂花红茶礼盒",
};
assert.equal(Object.keys(skuCoverageScenarios).length, teaSkus.length, "every active SKU must have a coverage scenario");
for (const sku of teaSkus) {
  const result = buildTeaAnswer(skuCoverageScenarios[sku.id]);
  assert.ok((result.recommendationSkus ?? []).some((candidate) => candidate.id === sku.id) || result.answer.includes(sku.name), `${sku.id} needs a reachable recommendation or exact-SKU scenario`);
  passed += 1;
}

// Natural-language constraint regression: this suite verifies the unified path
// input → intent → normalized hard constraints → structured SKU filter → ranking.
// It deliberately uses wording variants instead of one-off question-specific branches.
const naturalConstraintCases = [
  { question: "50g 礼盒有哪些", intent: "gift_catalog", answer: ["50g规格", "没有完全符合", "放宽规格后的备选"], count: 0 },
  { question: "100g 的商品有吗", intent: "product_recommendation", answer: ["100g规格", "没有完全符合"], count: 0 },
  { question: "有哪些6g试饮装", intent: "product_browse", count: 1, ids: ["mingqian-longjing-sample"] },
  { question: "60g 单罐都有什么", intent: "product_browse", count: 4 },
  { question: "150g 礼盒有哪些", intent: "gift_catalog", count: 4 },
  { question: "250g 礼盒有哪些", intent: "gift_catalog", count: 2 },
  { question: "要桂花，推荐一款", intent: "product_recommendation", count: 1, anyProductIds: ["osmanthus-longjing", "osmanthus-black-tea"] },
  { question: "别推荐桂花，给我选一款", intent: "product_recommendation", count: 1, excludedProductIds: ["osmanthus-longjing", "osmanthus-black-tea"] },
  { question: "我只想喝红茶，不喜欢桂花", intent: "product_recommendation", productIds: ["longjing-black-tea"], excludedProductIds: ["osmanthus-black-tea"] },
  { question: "我要红茶，但不要礼盒", intent: "product_recommendation", ids: ["longjing-black-tea-single-60g", "osmanthus-black-tea-single-60g"], excludedPackaging: "礼盒" },
  { question: "我喜欢龙井，给我推荐一款", intent: "product_recommendation", count: 1, anyProductIds: ["mingqian-longjing", "osmanthus-longjing"] },
  { question: "不要龙井，想喝红茶", intent: "product_recommendation", excludedProductIds: ["mingqian-longjing", "osmanthus-longjing"], anyProductIds: ["longjing-black-tea", "osmanthus-black-tea"] },
  { question: "有哪些礼盒", intent: "gift_catalog", count: 6 },
  { question: "红茶不要礼盒，帮我挑一个", intent: "product_recommendation", count: 1, excludedPackaging: "礼盒", anyProductIds: ["longjing-black-tea", "osmanthus-black-tea"] },
  { question: "我预算200送人，推荐什么", intent: "product_recommendation", minCount: 1, maxPrice: 200, absentPackage: "礼盒" },
  { question: "自己喝，预算120，推荐一款", intent: "product_recommendation", count: 1, maxPrice: 120 },
  { question: "想尝鲜，别推荐大包装", intent: "product_recommendation", ids: ["mingqian-longjing-sample"], maxWeight: 60 },
  { question: "预算150，想要单罐，排除桂花", intent: "product_recommendation", ids: ["mingqian-longjing-single-60g", "longjing-black-tea-single-60g"], excludedProductIds: ["osmanthus-longjing", "osmanthus-black-tea"] },
  { question: "有哪些60g的红茶", intent: "product_browse", count: 2, ids: ["longjing-black-tea-single-60g", "osmanthus-black-tea-single-60g"] },
  { question: "推荐一款250g礼盒", intent: "product_recommendation", count: 1 },
  { question: "给我推荐桂花红茶，不要礼盒", intent: "product_recommendation", count: 1, ids: ["osmanthus-black-tea-single-60g"], excludedPackaging: "礼盒" },
  { question: "250g 单罐有哪些", intent: "product_browse", answer: ["250g规格", "没有完全符合"], count: 0 },
  { question: "不要有桂花，推荐一个", intent: "product_recommendation", count: 1, excludedProductIds: ["osmanthus-longjing", "osmanthus-black-tea"] },
  { question: "不想要桂花，有什么适合自饮", intent: "product_recommendation", minCount: 1, excludedProductIds: ["osmanthus-longjing", "osmanthus-black-tea"] },
  { question: "红茶 100g 礼盒有吗", intent: "product_recommendation", answer: ["100g规格", "没有完全符合"], count: 0 },
];

for (const testCase of naturalConstraintCases) {
  const intentResult = classifyTeaIntent(testCase.question);
  const result = buildTeaAnswer(testCase.question);
  const skus = result.recommendationSkus ?? [];
  assert.equal(intentResult.intent, testCase.intent, `${testCase.question} should use the structured ${testCase.intent} path`);
  for (const text of testCase.answer ?? []) assert.ok(result.answer.includes(text), `${testCase.question} should include ${text}`);
  if (testCase.count !== undefined) assert.equal(skus.length, testCase.count, `${testCase.question} should return exactly ${testCase.count} strict SKU matches`);
  if (testCase.minCount !== undefined) assert.ok(skus.length >= testCase.minCount, `${testCase.question} should retain at least one strict SKU match`);
  for (const id of testCase.ids ?? []) assert.ok(skus.some((sku) => sku.id === id), `${testCase.question} should contain ${id}`);
  for (const productId of testCase.productIds ?? []) assert.ok(skus.some((sku) => sku.productIds.includes(productId)), `${testCase.question} should contain a SKU for ${productId}`);
  if (testCase.anyProductIds) assert.ok(skus.some((sku) => testCase.anyProductIds.includes(sku.productIds.find((productId) => testCase.anyProductIds.includes(productId)))), `${testCase.question} should contain a SKU from the allowed tea direction`);
  for (const productId of testCase.excludedProductIds ?? []) assert.ok(!skus.some((sku) => sku.productIds.includes(productId)), `${testCase.question} must exclude ${productId}`);
  if (testCase.excludedPackaging) assert.ok(!skus.some((sku) => sku.packaging === testCase.excludedPackaging), `${testCase.question} must exclude ${testCase.excludedPackaging}`);
  if (testCase.absentPackage) assert.ok(!skus.some((sku) => sku.packaging === testCase.absentPackage), `${testCase.question} must not force ${testCase.absentPackage}`);
  if (testCase.maxPrice !== undefined) assert.ok(skus.every((sku) => teaPriceEvidence.some((price) => sku.priceEvidenceIds?.includes(price.id) && price.amount <= testCase.maxPrice)), `${testCase.question} must honor the budget hard constraint`);
  if (testCase.maxWeight !== undefined) assert.ok(skus.every((sku) => sku.netWeightGrams <= testCase.maxWeight), `${testCase.question} must honor the maximum weight hard constraint`);
  assert.ok(!/REQ-|CAP\d|DOC\d|Evidence/.test(result.answer), `${testCase.question} must not leak unrelated internal identifiers`);
  passed += 1;
}

// Single-turn acceptance regressions for natural-language slots.
const slotSingleTurnCases = [
  "把所有 11 个 SKU 完整列出来", "有哪些60g", "有没有50g", "200元以内有什么", "500元以内有什么",
  "我要红茶", "我要桂花", "不要桂花", "我要桂花但不要红茶", "我要红茶但不要礼盒",
  "有红茶吗，小一点的", "预算150，想要单罐，排除桂花", "我想送人，但不要求礼盒，预算200以内",
];
for (const question of slotSingleTurnCases) {
  const turn = processTeaTurn(question);
  assert.notEqual(turn.intent, "unknown", `${question} must stay on the product-selection path`);
  if (question === "有没有50g") assert.equal(turn.state.constraints?.budgetMax, undefined, "50g must not be parsed as ¥50");
  if (question.includes("小一点")) assert.equal(turn.state.constraints?.sizePreference, "small", "small wording must be a soft size preference");
  if (question.includes("不要求礼盒")) assert.equal(turn.state.constraints?.excludePackageType, "礼盒", "gifting must not force gift packaging");
  passed += 1;
}

// Multi-turn slot semantics: SET, REPLACE, CLEAR and NEGATE, without query-specific branches.
let slotState = processTeaTurn("100以内有什么").state;
slotState = processTeaTurn("改成200以内", slotState).state;
assert.equal(slotState.constraints?.budgetMax, 200, "A: latest budget replaces old budget");
slotState = processTeaTurn("预算提高到500", slotState).state;
assert.equal(slotState.constraints?.budgetMax, 500, "A: raised budget replaces prior budget");

slotState = processTeaTurn("我要桂花").state;
slotState = processTeaTurn("算了，不要桂花", slotState).state;
assert.equal(slotState.constraints?.includeFlavor, undefined, "B: negate clears inclusion"); assert.equal(slotState.constraints?.excludeFlavor, "桂花", "B: negate writes exclusion");

slotState = processTeaTurn("我要礼盒").state;
slotState = processTeaTurn("不要礼盒了", slotState).state;
slotState = processTeaTurn("200以内", slotState).state;
assert.equal(slotState.constraints?.packageType, undefined, "C: package negate clears inclusion"); assert.equal(slotState.constraints?.excludePackageType, "礼盒", "C: package negate persists"); assert.equal(slotState.constraints?.budgetMax, 200, "C: budget is retained");

slotState = processTeaTurn("要60g的").state;
slotState = processTeaTurn("不限制规格了", slotState).state;
slotState = processTeaTurn("200以内", slotState).state;
assert.equal(slotState.constraints?.exactWeight, undefined, "D: clear removes exact weight"); assert.equal(slotState.constraints?.budgetMax, 200, "D: later budget is retained");

slotState = processTeaTurn("桂花的有什么").state;
slotState = processTeaTurn("我想要红茶", slotState).state;
slotState = processTeaTurn("算了，不要桂花", slotState).state;
assert.equal(slotState.constraints?.teaType, "红茶", "E: tea type remains current"); assert.equal(slotState.constraints?.excludeFlavor, "桂花", "E: flavor is reversed");

slotState = processTeaTurn("我要送朋友").state;
slotState = processTeaTurn("不要礼盒", slotState).state;
slotState = processTeaTurn("200以内", slotState).state;
assert.equal(slotState.constraints?.scenario, "gifting", "F: gifting stays a scenario"); assert.equal(slotState.constraints?.excludePackageType, "礼盒", "F: no gift box persists"); assert.equal(slotState.constraints?.budgetMax, 200, "F: budget is retained");

const longjingDisambiguation = processTeaTurn("不要龙井，我想喝红茶");
assert.equal(longjingDisambiguation.state.constraints?.teaType, "红茶", "G: completed tea type is red tea");
assert.ok((longjingDisambiguation.answer.recommendationSkus ?? []).some((sku) => sku.productIds.includes("longjing-black-tea")), "G: red tea remains recommendable");
assert.ok(longjingDisambiguation.answer.answer.includes("成品茶类属于红茶"), "G: response explains product-vs-ingredient distinction");
passed += 7;

// Final acceptance matrix: slot families are expressed with distinct wording so the
// parser is validated as a grammar, not as a list of hard-coded whole questions.
let finalState = processTeaTurn("预算100").state;
finalState = processTeaTurn("改200", finalState).state;
finalState = processTeaTurn("改500", finalState).state;
finalState = processTeaTurn("现在只看150以内", finalState).state;
assert.equal(finalState.constraints?.budgetMax, 150, "A: budget replacement keeps only ¥150"); passed += 1;

finalState = processTeaTurn("要60g").state;
finalState = processTeaTurn("改150g", finalState).state;
finalState = processTeaTurn("算了规格不限", finalState).state;
assert.equal(finalState.constraints?.exactWeight, undefined, "B: unrestricted specification clears exact weight"); assert.equal(finalState.constraints?.sizePreference, undefined, "B: unrestricted specification clears size preference"); passed += 1;

const scopedRedTea = processTeaTurn("不要桂花的红茶");
assert.equal(scopedRedTea.state.constraints?.teaType, "红茶", "E: red tea remains positive after flavor negation"); assert.equal(scopedRedTea.state.constraints?.excludeFlavor, "桂花", "E: osmanthus is the only exclusion"); assert.ok((scopedRedTea.answer.recommendationSkus ?? []).every((sku) => sku.productIds.includes("longjing-black-tea")), "E: returns non-osmanthus red tea"); passed += 1;

finalState = processTeaTurn("我要红茶").state;
const redNoGift = processTeaTurn("不要礼盒", finalState);
assert.equal(redNoGift.state.constraints?.teaType, "红茶", "F: package update cannot clear tea type"); assert.ok((redNoGift.answer.recommendationSkus ?? []).every((sku) => sku.packaging !== "礼盒"), "F: all retained red tea candidates are non-gift packaging"); passed += 1;

finalState = processTeaTurn("我要礼盒").state;
const giftBudget = processTeaTurn("预算500", finalState);
assert.ok((giftBudget.answer.recommendationSkus ?? []).every((sku) => sku.packaging === "礼盒"), "G: gift-box requirement is a hard filter"); passed += 1;

finalState = processTeaTurn("不要龙井绿茶，我想喝红茶").state;
const noLongjingIngredient = processTeaTurn("那如果连龙井原料也不要呢", finalState);
assert.equal(noLongjingIngredient.state.constraints?.ingredientExclusion, "龙井", "H: explicit ingredient exclusion is recorded"); assert.equal((noLongjingIngredient.answer.recommendationSkus ?? []).length, 0, "H: all catalog SKUs are excluded at ingredient level"); assert.ok(noLongjingIngredient.answer.answer.includes("均基于龙井相关原料制作"), "H: no-result explanation identifies the real conflict"); passed += 1;

finalState = processTeaTurn("送长辈").state;
finalState = processTeaTurn("预算500", finalState).state;
finalState = processTeaTurn("改成送朋友", finalState).state;
assert.equal(finalState.constraints?.recipient, "朋友 / 同事", "I: recipient replaces independently"); assert.equal(finalState.constraints?.budgetMax, 500, "I: recipient update preserves budget"); passed += 1;

finalState = processTeaTurn("送朋友").state;
finalState = processTeaTurn("预算300", finalState).state;
finalState = processTeaTurn("改成自己喝", finalState).state;
assert.equal(finalState.constraints?.scenario, "self", "J: scenario switches to self use"); assert.equal(finalState.constraints?.recipient, undefined, "J: self use clears recipient"); assert.equal(finalState.constraints?.budgetMax, 300, "J: scenario update preserves budget"); passed += 1;

finalState = processTeaTurn("我要红茶").state;
const smallRed = processTeaTurn("想要小一点", finalState);
assert.equal(smallRed.state.constraints?.sizePreference, "small", "K: small is a ranking preference"); assert.equal(smallRed.answer.recommendationSkus?.[0]?.netWeightGrams, 60, "K: small red tea ranks 60g first"); passed += 1;

const budgetRanking = processTeaTurn("预算500，推荐三款");
assert.equal(budgetRanking.answer.recommendationSkus?.length, 3, "L: requested count controls recommendation length"); assert.ok((budgetRanking.answer.recommendationSkus?.[0]?.priceEvidenceIds ?? []).some((id) => teaPriceEvidence.find((price) => price.id === id)?.amount >= 400), "L: budget utilization ranks a near-budget product first"); passed += 1;

finalState = processTeaTurn("预算500").state;
finalState = processTeaTurn("想尝鲜", finalState).state;
const trialOverBudget = processTeaTurn("不要大包装", finalState);
assert.equal(trialOverBudget.answer.recommendationSkus?.[0]?.id, "mingqian-longjing-sample", "M: explicit trial preference outranks budget utilization"); passed += 1;

const languageVariants = ["五百以内帮我选个好点的", "我大概能花四五百", "别太便宜，预算500", "500封顶", "红茶，别带桂花", "想喝红茶但是不想要桂花味", "送朋友，不用礼盒", "有没有小罐一点的"];
for (const question of languageVariants) {
  const turn = processTeaTurn(question);
  assert.notEqual(turn.intent, "unknown", `${question} must stay on a structured selection path`);
  if (question.startsWith("五百")) assert.equal(turn.state.constraints?.budgetMax, 500, "Chinese money form must map to budget");
  if (question.includes("四五百")) assert.equal(turn.state.constraints?.budgetMax, 450, "approximate Chinese money form must map to midpoint budget");
  passed += 1;
}

const skuChunks = createTeaKnowledgeChunks().filter((chunk) => chunk.id.startsWith("SKU-"));
assert.equal(skuChunks.length, teaSkus.length, "RAG corpus must contain one independently addressable chunk per active SKU");
assert.equal(new Set(skuChunks.map((chunk) => chunk.id)).size, teaSkus.length, "SKU RAG chunk IDs must remain unique");
assert.ok(skuChunks.every((chunk) => chunk.content.includes("sku_id：") && chunk.content.includes("净含量：") && chunk.content.includes("包装形式：")), "every SKU RAG chunk must retain its identity, net content and package type");
passed += 1;

console.log(`Tea assistant regression: ${passed}/${cases.length + 116} passed`);
