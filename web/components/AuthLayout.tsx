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
    <div className="min-h-screen bg-[#f5f7f5] p-0 text-zinc-900 dark:bg-[#071815] dark:text-white lg:p-6">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-60 [background-image:radial-gradient(rgba(15,76,69,0.12)_1px,transparent_1px)] [background-size:20px_20px] dark:opacity-20"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col overflow-hidden bg-white shadow-2xl shadow-[#123847]/10 dark:bg-zinc-950 lg:min-h-[calc(100vh-3rem)] lg:flex-row lg:rounded-[2rem]">
        <aside className="relative flex flex-col justify-between overflow-hidden bg-[#103d38] px-6 py-8 text-white sm:px-10 lg:w-[48%] lg:px-14 lg:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-28 h-72 w-72 rounded-full border-[32px] border-emerald-300/10"
          />
          <div>
            <div className="relative flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Daily Hisab"
                width={44}
                height={44}
                className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-lg shadow-black/10"
                priority
              />
              <div>
                <p className="text-base font-semibold tracking-tight">Daily Hisab</p>
                <p className="text-xs text-emerald-100/70">Personal finance, simplified</p>
              </div>
            </div>

            <div className="relative mt-12 max-w-md lg:mt-24">
              <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-emerald-200 uppercase">
                Everyday money management
              </p>
              <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-[2.7rem]">
                {headline}
              </h1>
              <p className="mt-5 max-w-sm text-base leading-relaxed text-emerald-50/75">
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

        <main className="flex flex-1 items-start justify-center bg-white px-5 py-10 sm:px-10 lg:items-center lg:px-16 lg:py-14 dark:bg-zinc-950">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <Image
                src="/logo.png"
                alt="Daily Hisab"
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl object-contain shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800"
              />
              <span className="text-sm font-semibold tracking-tight">Daily Hisab</span>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
