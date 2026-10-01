import type { MonthlyInsight as MonthlyInsightData } from "@/lib/monthly-insights";

type MonthlyInsightProps = {
  insight: MonthlyInsightData;
};

export default function MonthlyInsight({ insight }: MonthlyInsightProps) {
  return (
    <section
      className="relative overflow-hidden rounded-xl border border-gold/40 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 px-3 py-1 shadow-sm shadow-amber-900/10 dark:border-gold/30 dark:from-amber-950/60 dark:via-amber-950/40 dark:to-brand-deep"
      aria-labelledby="monthly-insight-heading"
    >
      <div className="pointer-events-none absolute -right-5 -top-8 h-20 w-20 rounded-full bg-gold/20 blur-2xl" />
      <div className="relative flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/25 text-base shadow-sm dark:bg-gold/20"
          aria-hidden="true"
        >
          {insight.icon}
        </span>
        <p className="text-sm font-semibold leading-5 text-amber-950 dark:text-amber-50">
          {insight.message}
        </p>
      </div>
    </section>
  );
}
