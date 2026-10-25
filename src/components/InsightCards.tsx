import { AlertTriangle, Lightbulb, ListChecks, Newspaper, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InsightGroup } from "@/utils/payload";
import { titleCase } from "@/utils/format";
import { cn } from "@/utils/cn";

const META: Record<InsightGroup["kind"], { icon: LucideIcon; chip: string; border: string }> = {
  insight: { icon: Sparkles, chip: "bg-emerald-50 text-emerald-600", border: "hover:border-emerald-200" },
  risk: { icon: AlertTriangle, chip: "bg-amber-50 text-amber-600", border: "hover:border-amber-200" },
  action: { icon: Lightbulb, chip: "bg-violet-50 text-violet-600", border: "hover:border-violet-200" },
  news: { icon: Newspaper, chip: "bg-sky-50 text-sky-600", border: "hover:border-sky-200" },
  narrative: { icon: Sparkles, chip: "bg-emerald-50 text-emerald-600", border: "hover:border-emerald-200" },
  list: { icon: ListChecks, chip: "bg-slate-100 text-slate-500", border: "hover:border-slate-300" },
};

export function InsightCards({ groups, max = 4 }: { groups: InsightGroup[]; max?: number }) {
  const shown = groups.slice(0, max);
  if (shown.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {shown.map((group, i) => {
        const meta = META[group.kind];
        const Icon = meta.icon;
        return (
          <article
            key={`${group.title}-${i}`}
            className={cn("rounded-2xl border border-slate-200/80 bg-white p-5 transition-colors", meta.border)}
          >
            <header className="flex items-center gap-2.5">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", meta.chip)}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <h4 className="text-sm font-semibold tracking-tight text-slate-800">{titleCase(group.title)}</h4>
            </header>
            {group.kind === "narrative" ? (
              <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-[13px] leading-6 text-slate-600">{group.items[0]}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {group.items.slice(0, 4).map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                    <span className="line-clamp-3">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}
