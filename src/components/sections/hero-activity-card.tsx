import { Check, Circle, Clock3, FileText, Layers3 } from "lucide-react";

const completedItems = [
  "Project updates gathered",
  "Progress summary drafted",
];

export function HeroActivityCard() {
  return (
    <div className="relative w-full max-w-[460px]">
      <div aria-hidden="true" className="absolute -right-5 -top-8 size-28 rounded-full bg-accent/50 blur-2xl sm:-right-8 sm:-top-10 sm:size-40" />
      <div className="absolute -bottom-7 -left-5 size-32 rounded-full bg-accent/35 blur-2xl sm:-bottom-9 sm:-left-8 sm:size-44" aria-hidden="true" />
      <article className="relative rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8" aria-label="Example GptBots weekly meeting brief">
        <div className="mb-6 flex items-start gap-3">
          <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/50 text-primary">
            <FileText className="size-[18px]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Weekly meeting brief</p>
            <h2 className="mt-1 text-base font-semibold leading-6 text-foreground">Preparing your update</h2>
          </div>
          <span className="ml-auto mt-1 size-2 shrink-0 rounded-full bg-accent ring-4 ring-accent/20" aria-label="In progress" />
        </div>

        <ul className="space-y-4">
          {completedItems.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm leading-[22px] text-muted-foreground">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/40">
                <Check className="size-3.5 text-primary" aria-hidden="true" />
              </span>
              {item}
            </li>
          ))}
          <li className="flex items-center gap-3 text-sm font-medium leading-[22px] text-foreground">
            <Circle className="size-5 shrink-0 fill-primary/10 text-primary" aria-hidden="true" />
            One decision needs your input
          </li>
        </ul>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />Ready in 12 min</span>
          <span className="inline-flex items-center gap-1.5"><Layers3 className="size-3.5" aria-hidden="true" />4 sources used</span>
        </div>
      </article>
      <div className="absolute -bottom-5 right-5 hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-card sm:flex">
        <span className="size-2 rounded-full bg-success" /> Your teammate is on it
      </div>
    </div>
  );
}
