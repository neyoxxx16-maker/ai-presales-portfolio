import type { RetrievedProduct } from "@/types/tea";

export function ProductRecommendation({ products }: { products: RetrievedProduct[] }) {
  if (!products.length) return null;
  return (
    <div className="mt-5 space-y-3">
      <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">推荐商品</p>
      {products.map((product) => (
        <article key={product.id} className="rounded-[20px] border border-black/5 bg-[#f7f8f9] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-base font-medium">{product.name}</h4><p className="mt-1 text-xs text-neutral-500">{product.category} · {product.spec}</p></div><span className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white">¥ {product.price}</span></div>
          <p className="mt-4 text-sm text-neutral-600"><span className="text-neutral-400">风味</span> · {product.flavor}</p>
          <p className="mt-2 text-sm text-neutral-600"><span className="text-neutral-400">适用场景</span> · {product.scene.join("、")}</p>
          <p className="mt-3 border-t border-black/5 pt-3 text-sm leading-6 text-neutral-600"><span className="font-medium text-black">推荐理由：</span>{product.matchReasons.join("；") || product.description}</p>
        </article>
      ))}
    </div>
  );
}
