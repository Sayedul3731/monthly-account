"use client";

import { PlusIcon, WalletIcon } from "./icons";

type Props = {
  onAddExpense: () => void;
};

export default function ExpenseEmptyState({ onAddExpense }: Props) {
  return (
    <div lang="bn" className="flex flex-col items-center px-4 py-9 text-center sm:py-12">
      <div aria-hidden="true" className="relative mb-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/10 bg-paper/70 text-brand shadow-sm [&>svg]:h-7 [&>svg]:w-7 dark:border-white/10 dark:bg-brand/30 dark:text-gold">
          <WalletIcon />
        </div>
        <span className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gold text-brand [&>svg]:h-3.5 [&>svg]:w-3.5 dark:border-zinc-900">
          <PlusIcon />
        </span>
      </div>
      <h3 className="text-base font-semibold leading-7 text-brand sm:text-lg dark:text-white">
        এখনও কোনো খরচ যোগ করা হয়নি।
      </h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        প্রথম খরচটি যোগ করে আপনার মাসের হিসাব শুরু করুন।
      </p>
      <button
        type="button"
        onClick={onAddExpense}
        className="mt-6 inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:focus-visible:outline-gold"
      >
        <PlusIcon />
        প্রথম খরচ যোগ করুন
      </button>
    </div>
  );
}
