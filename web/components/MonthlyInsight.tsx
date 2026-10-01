import type { MonthlyInsight as MonthlyInsightData } from "@/lib/monthly-insights";

type MonthlyInsightProps = {
  insight: MonthlyInsightData;
};

export default function MonthlyInsight({ insight }: MonthlyInsightProps) {
  return (
    <section
      className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25"
      aria-labelledby="monthly-insight-heading"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg dark:bg-amber-900/50"
          aria-hidden="true"
        >
          {insight.icon}
        </span>
        <div>
          <h2
            id="monthly-insight-heading"
            className="text-sm font-semibold text-amber-950 dark:text-amber-100"
          >
            Insight
          </h2>
          <p className="mt-0.5 text-sm leading-6 text-amber-900 dark:text-amber-200">
            {insight.message}
          </p>
        </div>
      </div>
    </section>
  );
}
