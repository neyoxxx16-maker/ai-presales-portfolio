import type { RetrievedKnowledge } from "@/types/tea";

export function SourceList({ sources }: { sources: RetrievedKnowledge[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-5 border-t border-black/5 pt-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-neutral-400">参考资料</p>
      <div className="mt-3 space-y-2">
        {sources.map((source, index) => (
          <details key={source.id} className="group rounded-xl border border-black/5 bg-white px-4 py-3">
            <summary className="cursor-pointer list-none text-sm text-neutral-700"><span className="mr-2 font-medium text-black">[{index + 1}]</span>{source.title}<span className="ml-2 text-xs text-neutral-400">{source.type} · {source.sourceIds.join(" / ")}</span></summary>
            <p className="pt-3 text-sm leading-6 text-neutral-500">{source.excerpt}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
