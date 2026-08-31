import { getTeaSourceDisplayNames } from "@/data/tea/sources";
import type { RetrievedKnowledge } from "@/types/tea";

const friendlyType: Record<RetrievedKnowledge["type"], string> = {
  "品牌资料": "品牌资料",
  "茶品资料": "茶品资料",
  "SKU资料": "商品资料",
  "冲泡指南": "冲泡指南",
  "售后与边界": "售后说明",
  "冲突处理": "使用边界",
  "推荐规则": "选茶指南",
};

function friendlyTitle(title: string) {
  return title.replace(/\s·\s(?:茶品资料|SKU资料)$/, "");
}

export function SourceList({ sources }: { sources: RetrievedKnowledge[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-5 border-t border-black/5 pt-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">参考资料</p>
      <div className="mt-3 space-y-2">
        {sources.map((source, index) => {
          const displaySources = getTeaSourceDisplayNames(source.sourceIds);
          return (
            <details key={source.id} className="group rounded-xl border border-black/5 bg-white px-4 py-3">
              <summary className="cursor-pointer list-none text-sm text-neutral-700"><span className="mr-2 font-medium text-black">[{index + 1}]</span>{friendlyTitle(source.title)}<span className="ml-2 text-xs text-neutral-400">{friendlyType[source.type]}</span></summary>
              <p className="pt-3 text-sm leading-6 text-neutral-500">{source.excerpt}</p>
              {displaySources.length ? <p className="pt-2 text-xs leading-5 text-neutral-400">资料来源：{displaySources.join(" · ")}</p> : null}
            </details>
          );
        })}
      </div>
    </div>
  );
}
