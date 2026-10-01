import type { MonthlyInsight as MonthlyInsightData } from "@/lib/monthly-insights";
import { CloseIcon } from "./icons";

type MonthlyInsightProps = {
  insight: MonthlyInsightData;
  onDismiss: () => void;
};

export default function MonthlyInsight({
  insight,
  onDismiss,
}: MonthlyInsightProps) {
  return (
    <section
      className="relative overflow-hidden rounded-xl border border-gold/40 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 px-3 py-1 shadow-sm shadow-amber-900/10 dark:border-gold/30 dark:from-amber-950/60 dark:via-amber-950/40 dark:to-brand-deep"
      aria-labelledby="monthly-insight-heading"
    >
      <div className="pointer-events-none absolute -right-5 -top-8 h-20 w-20 rounded-full bg-gold/20 blur-2xl" />
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-1 top-1 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-800/70 transition hover:bg-amber-900/10 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/60 dark:text-amber-100/70 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="Dismiss insight"
        title="Dismiss insight"
      >
        <CloseIcon />
      </button>
      <div className="relative flex items-center gap-2.5 pr-8">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/25 text-base shadow-sm dark:bg-gold/20"
          aria-hidden="true"
        >
          {insight.icon}
        </span>
        <p
          id="monthly-insight-heading"
          className="text-sm font-semibold leading-5 text-amber-950 dark:text-amber-50"
        >
          {insight.message}
        </p>
      </div>
    </section>
  );
}
