import Image from "next/image";

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
};

export default function LoadingState({
  label = "Loading your workspace",
  compact = false,
}: LoadingStateProps) {
  if (compact) {
    return (
      <section
        className="flex min-h-[20vh] w-full items-center justify-center px-4 py-6"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 text-sm text-brand/70 dark:text-zinc-300">
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand/15 border-t-brand motion-reduce:animate-none dark:border-white/15 dark:border-t-gold"
            aria-hidden="true"
          />
          <p>{label}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="flex min-h-[60vh] w-full items-center justify-center px-6 py-12"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/10 bg-white shadow-[0_4px_16px_rgba(18,56,71,0.06)] dark:border-white/10 dark:bg-zinc-900">
          <Image
            src="/protidiner-hisab-logo.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
            loading="eager"
          />
        </div>
        <p lang="bn" className="mt-5 text-xl font-semibold tracking-normal text-brand dark:text-white">
          প্রতিদিনের হিসাব
        </p>
        <p className="mt-1.5 text-xs leading-5 text-brand/60 dark:text-zinc-400">
          Personal finance, simplified
        </p>
        <div
          className="mt-7 h-0.5 w-40 overflow-hidden rounded-full bg-brand/10 dark:bg-white/10"
          aria-hidden="true"
        >
          <span className="loading-track block h-full w-1/2 rounded-full bg-brand dark:bg-gold" />
        </div>
        <p className="mt-3 text-xs leading-5 text-brand/70 dark:text-zinc-400">
          {label}
        </p>
      </div>
    </section>
  );
}
