"use client";

import { useId, useState } from "react";
import { createPersonalCategory, type ApiCategory } from "@/lib/api";
import { type TransactionType } from "@/lib/finance";
import { getStoredUser } from "@/lib/auth";
import { getOfflineLookups, saveOfflineLookups } from "@/lib/offline-ledger";

type Props = {
  type: TransactionType;
  disabled?: boolean;
  onCreated: (category: ApiCategory) => void;
  onBusyChange?: (busy: boolean) => void;
};

const fieldClass =
  "w-full rounded-xl border border-brand/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

export const CATEGORY_CREATED_EVENT = "personal-category-created";

// Uses buttons within the enclosing transaction form, avoiding nested forms.
export default function CategoryCreator({
  type,
  disabled,
  onCreated,
  onBusyChange,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📌");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function create() {
    if (saving || disabled) return;
    setError("");
    setSuccess("");
    if (!name.trim()) {
      setError("Enter a category name.");
      return;
    }
    if (!navigator.onLine) {
      setError("Connect to the internet to create a category.");
      return;
    }
    setSaving(true);
    onBusyChange?.(true);
    try {
      const category = await createPersonalCategory({ name, type, icon });
      const userId = getStoredUser()?.id;
      const cached = userId ? getOfflineLookups(userId) : null;
      if (userId && cached) {
        saveOfflineLookups(
          userId,
          [
            ...cached.categories.filter((entry) => entry.id !== category.id),
            category,
          ],
          cached.transactionTypes,
        );
      }
      window.dispatchEvent(
        new CustomEvent(CATEGORY_CREATED_EVENT, { detail: category }),
      );
      onCreated(category);
      setName("");
      setOpen(false);
      setSuccess(`Created ${category.name}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create category.",
      );
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen(true);
            setError("");
            setSuccess("");
          }}
          className="text-sm font-semibold text-brand hover:underline disabled:opacity-50 dark:text-gold"
        >
          + Add category
        </button>
      ) : (
        <fieldset
          disabled={saving || disabled}
          className="space-y-3 rounded-xl border border-brand/10 bg-paper/60 p-3 dark:border-zinc-700 dark:bg-zinc-900"
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              event.target instanceof HTMLInputElement
            ) {
              event.preventDefault();
              void create();
            }
          }}
        >
          <legend className="px-1 text-sm font-semibold text-brand dark:text-white">
            New {type} category
          </legend>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Only your account can use this category.
          </p>
          <div>
            <label
              htmlFor={`${id}-name`}
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Name
            </label>
            <input
              id={`${id}-name`}
              className={fieldClass}
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Pet care"
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor={`${id}-icon`}
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Icon (optional)
            </label>
            <input
              id={`${id}-icon`}
              className={fieldClass}
              value={icon}
              maxLength={10}
              onChange={(event) => setIcon(event.target.value)}
              placeholder="📌"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void create()}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create category"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="px-2 py-2 text-sm text-zinc-500 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </fieldset>
      )}
      {error && (
        <p
          role="alert"
          className="mt-2 text-sm text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-2 text-sm text-brand dark:text-gold">
          {success}
        </p>
      )}
    </div>
  );
}
