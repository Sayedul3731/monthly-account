type LoadingStateProps = {
  label?: string;
  compact?: boolean;
};

export default function LoadingState({
  label = "Please wait",
  compact = false,
}: LoadingStateProps) {
  return (
    <section
      className={`flex w-full items-center justify-center px-4 ${compact ? "min-h-[20vh] py-6" : "min-h-[60vh] py-10"}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 shadow-sm ring-1 ring-emerald-100 dark:bg-emerald-950/50 dark:ring-emerald-900/60">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent dark:border-emerald-400" aria-hidden />
        <span className="sr-only">{label}</span>
      </div>
    </section>
  );
}
