import Image from "next/image";
import { CheckIcon } from "./icons";

const HIGHLIGHTS = [
  "A clear view of every transaction",
  "Simple monthly budgeting",
  "Your financial data, always private",
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
    <div className="min-h-[100dvh] bg-[#f5f7f5] p-0 text-zinc-900 dark:bg-[#071815] dark:text-white lg:min-h-screen lg:p-6">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-60 [background-image:radial-gradient(rgba(15,76,69,0.12)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-20"
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col overflow-hidden bg-white shadow-2xl shadow-[#123847]/10 dark:bg-zinc-950 lg:min-h-[calc(100vh-3rem)] lg:flex-row lg:rounded-[2rem]">
        <aside className="relative flex flex-col justify-between overflow-hidden bg-[#103d38] px-5 pt-5 pb-6 text-white sm:px-10 sm:py-8 lg:w-[48%] lg:px-14 lg:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-28 h-72 w-72 rounded-full border-[32px] border-emerald-300/10"
          />
          <div>
            <div className="relative flex items-center gap-2.5 sm:gap-3">
              <Image
                src="/logo.png"
                alt="Daily Hisab"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl bg-white object-contain p-1 shadow-lg shadow-black/10 sm:h-11 sm:w-11"
                priority
              />
              <div>
                <p className="text-sm font-semibold tracking-tight sm:text-base">Daily Hisab</p>
                <p className="text-xs text-emerald-100/70">Personal finance, simplified</p>
              </div>
            </div>

            <div className="relative mt-8 max-w-md sm:mt-12 lg:mt-24">
              <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-emerald-200 uppercase sm:mb-4 sm:text-xs sm:tracking-[0.18em]">
                Everyday money management
              </p>
              <h1 className="text-2xl leading-[1.15] font-semibold tracking-tight sm:text-4xl sm:leading-tight lg:text-[2.7rem]">
                {headline}
              </h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-emerald-50/75 sm:mt-5 sm:text-base">
                {subtext}
              </p>

              <ul className="mt-10 hidden space-y-4 lg:block">
                {HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-emerald-50/90">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-200 ring-1 ring-emerald-100/15">
                      <CheckIcon />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="relative mt-10 hidden text-xs text-emerald-100/50 lg:block">
            Built for a calmer, clearer financial life.
          </p>
        </aside>

        <main className="flex flex-1 items-start justify-center bg-[#f8faf9] px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:bg-white sm:px-10 sm:py-10 lg:items-center lg:px-16 lg:py-14 dark:bg-zinc-950">
          <div className="w-full max-w-md">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
