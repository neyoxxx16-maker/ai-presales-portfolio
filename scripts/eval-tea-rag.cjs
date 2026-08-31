const queries = ["桂花红茶怎么泡？", "桂花红茶适合什么人？", "桂花龙井单罐多少钱？", "你们有铁观音吗？", "桂花红茶能治失眠吗？", "298和288有什么区别？", "我不喜欢红茶，预算500送礼", "500能买两盒吗？", "明前龙井", "60g那个", "桂花龙井和桂花红茶哪个更清爽？", "高端西湖龙井可以网上买吗？", "怎么保存茶叶？", "最便宜的礼盒是哪款？", "418对应哪些产品？"];
console.log("Tea RAG evaluation (run `npm run build:tea-index` with a configured provider before live evaluation)");
for (const query of queries) console.log(JSON.stringify({ query, mode: "fallback-without-live-index", retrievedChunkIds: [], similarity: [], citations: [], pass: "requires-live-index" }));
