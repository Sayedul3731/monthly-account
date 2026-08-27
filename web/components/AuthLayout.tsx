import Image from "next/image";
import { CheckIcon } from "./icons";

const HIGHLIGHTS = [
  "Track income and expenses by month",
  "Set budgets and stay on target",
  "Export or import your data anytime",
] as const;

type AuthLayoutProps = {
  children: React.ReactNode;
  headline: string;
  subtext: string;
};

export default function AuthLayout({
  children,
  headline,
  subtext,
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2] [background-image:linear-gradient(to_right,rgba(24,24,27,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(24,24,27,0.04)_1px,transparent_1px)] [background-size:48px_48px] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]"
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col lg:flex-row">
        <aside className="relative flex flex-col justify-between px-6 py-8 sm:px-10 lg:w-[46%] lg:px-12 lg:py-14">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="AyBey"
                width={44}
                height={44}
                className="h-11 w-11 rounded-xl object-contain shadow-sm ring-1 ring-zinc-200/80 dark:ring-zinc-700"
                priority
              />
              <div>
                <p className="text-base font-semibold tracking-tight text-zinc-900 dark:text-white">
                  AyBey
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Personal finance, simply tracked
                </p>
              </div>
            </div>

            <div className="mt-10 max-w-md lg:mt-16">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
                {headline}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                {subtext}
              </p>

              <ul className="mt-8 hidden space-y-3.5 lg:block">
                {HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckIcon />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-10 hidden text-xs text-zinc-400 lg:block dark:text-zinc-500">
            Your data stays private to your account.
          </p>
        </aside>

        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:px-8 lg:items-center lg:px-12 lg:py-14">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
