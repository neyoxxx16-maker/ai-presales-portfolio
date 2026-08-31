import { teaPriceEvidence, teaProducts } from "@/data/tea/products";
import type { RetrievedProduct, RetrievedSku, TeaSku } from "@/types/tea";

function priceLabel(sku: TeaSku) {
  const price = teaPriceEvidence.find((item) => sku.priceEvidenceIds?.includes(item.id));
  if (!price) return "价格待确认";
  if (price.priceType === "new_customer") return `新客价 ¥${price.amount}`;
  return `¥${price.amount}${price.shippingIncluded ? " 包邮" : ""}`;
}

function skuFeature(sku: TeaSku) {
  return sku.productIds.map((id) => teaProducts.find((product) => product.id === id)?.flavor.slice(0, 2).join("、")).filter(Boolean).join("；");
}

export function ProductRecommendation({ products, skus = [] }: { products: RetrievedProduct[]; skus?: RetrievedSku[] }) {
  if (!products.length && !skus.length) return null;
  return (
    <div className="mt-5 space-y-3">
      <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">推荐商品</p>
      {skus.map((sku) => <article key={sku.id} className="rounded-[20px] border border-black/5 bg-[#f7f8f9] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-base font-medium">{sku.name}</h4><p className="mt-1 text-xs text-neutral-500">{sku.spec} · {sku.netContent} · {sku.packaging}</p></div><span className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white">{priceLabel(sku)}</span></div>
        {skuFeature(sku) && <p className="mt-4 text-sm text-neutral-600"><span className="text-neutral-400">口感特点</span> · {skuFeature(sku)}</p>}
        <p className="mt-3 border-t border-black/5 pt-3 text-sm leading-6 text-neutral-600"><span className="font-medium text-black">推荐理由：</span>{sku.matchReasons.join("；")}</p>
      </article>)}
      {!skus.length && products.map((product) => {
        const sku = product.relatedSkus[0];
        const label = sku ? priceLabel(sku) : "需匹配具体商品";
        return <article key={product.id} className="rounded-[20px] border border-black/5 bg-[#f7f8f9] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-base font-medium">{product.name}</h4><p className="mt-1 text-xs text-neutral-500">{product.category}{sku ? ` · ${sku.spec} · ${sku.netContent}` : " · 茶品资料"}</p></div><span className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white">{label}</span></div>
          <p className="mt-4 text-sm text-neutral-600"><span className="text-neutral-400">风味</span> · {product.flavor.join("、")}</p>
          <p className="mt-2 text-sm text-neutral-600"><span className="text-neutral-400">适用场景</span> · {product.scene.join("、")}</p>
          <p className="mt-3 border-t border-black/5 pt-3 text-sm leading-6 text-neutral-600"><span className="font-medium text-black">推荐理由：</span>{product.matchReasons.join("；") || product.description}</p>
        </article>;
      })}
    </div>
  );
}
