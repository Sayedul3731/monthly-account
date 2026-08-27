"use client";

import { useEffect, useState } from "react";
import { SpinnerIcon, TrashIcon } from "../icons";

export const inputBase =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500";
export const inputOk =
  "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700";
export const inputErr =
  "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/60";

export function fieldClass(hasError: boolean) {
  return `${inputBase} ${hasError ? inputErr : inputOk}`;
}

export function AdminAlert({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = kind === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
          : "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
      }
    >
      {children}
    </div>
  );
}

export function AdminEmpty({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={20}
        className="px-6 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
      >
        {children}
      </td>
    </tr>
  );
}

export function ConfirmDeleteButton({
  onDelete,
  disabled,
  label = "Delete",
}: {
  onDelete: () => Promise<void> | void;
  disabled?: boolean;
  label?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  async function handleClick() {
    if (disabled || busy) return;
    if (!armed) {
      setArmed(true);
      return;
    }

    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        armed
          ? "bg-rose-600 text-white hover:bg-rose-700"
          : "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
      }`}
    >
      {busy ? (
        <SpinnerIcon className="animate-spin" />
      ) : (
        <TrashIcon />
      )}
      {busy ? "Deleting…" : armed ? "Confirm" : label}
    </button>
  );
}

export function EmojiPicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (icon: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onChange(icon)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
            value === icon
              ? "bg-emerald-100 ring-2 ring-emerald-500 dark:bg-emerald-950/60"
              : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          }`}
          aria-label={`Choose ${icon}`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

export function formatShortDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function titleCase(value: string): string {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
