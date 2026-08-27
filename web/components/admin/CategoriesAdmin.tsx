"use client";

import { useEffect, useState } from "react";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type ApiCategory,
} from "@/lib/api";
import type { TransactionType } from "@/lib/finance";
import { CloseIcon, EditIcon, PlusIcon, SpinnerIcon } from "../icons";
import {
  AdminAlert,
  AdminEmpty,
  ConfirmDeleteButton,
  EmojiPicker,
  fieldClass,
  titleCase,
} from "./ui";

const CATEGORY_ICONS = [
  "💼",
  "🖥️",
  "📈",
  "🎁",
  "📌",
  "🍽️",
  "🚗",
  "📄",
  "🛍️",
  "💊",
  "🎬",
  "🏠",
  "✈️",
  "☕",
  "🎮",
  "💳",
];

type FormState = {
  name: string;
  type: TransactionType;
  icon: string;
};

const EMPTY_FORM: FormState = { name: "", type: "expense", icon: "📌" };

type Props = {
  onError: (message: string) => void;
};

export default function CategoriesAdmin({ onError }: Props) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setCategories(await fetchCategories());
      } catch (err) {
        if (!cancelled) {
          onError(
            err instanceof Error ? err.message : "Failed to load categories",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setNameError(null);
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function openEdit(category: ApiCategory) {
    setEditing(category);
    setForm({
      name: category.name,
      type: category.type,
      icon: category.icon || "📌",
    });
    setNameError(null);
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setNameError(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    const name = form.name.trim();
    if (!name) {
      setNameError("Enter a category name.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateCategory(editing.id, {
          name,
          type: form.type,
          icon: form.icon,
        });
        setCategories((prev) =>
          prev
            .map((category) =>
              category.id === updated.id ? updated : category,
            )
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setSuccess(`Updated ${updated.name}.`);
      } else {
        const created = await createCategory({
          name,
          type: form.type,
          icon: form.icon,
        });
        setCategories((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setSuccess(`Created ${created.name}.`);
      }
      closeForm();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save category";
      if (/already exists|conflict/i.test(message)) {
        setNameError(message);
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: ApiCategory) {
    try {
      await deleteCategory(category.id);
      setCategories((prev) =>
        prev.filter((entry) => entry.id !== category.id),
      );
      if (editing?.id === category.id) closeForm();
      setSuccess(`Deleted ${category.name}.`);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to delete category",
      );
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">
            Categories
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Shared income and expense categories used on every account.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <PlusIcon />
          Add category
        </button>
      </div>

      {success && <AdminAlert kind="success">{success}</AdminAlert>}

      {formOpen && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {editing ? "Edit category" : "New category"}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close form"
            >
              <CloseIcon />
            </button>
          </div>
          {formError && (
            <div className="mb-4">
              <AdminAlert kind="error">{formError}</AdminAlert>
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  setNameError(null);
                }}
                className={fieldClass(Boolean(nameError))}
                maxLength={100}
                required
              />
              {nameError && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {nameError}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as TransactionType,
                  }))
                }
                className={fieldClass(false)}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Icon
              </label>
              <EmojiPicker
                value={form.icon}
                options={CATEGORY_ICONS}
                onChange={(icon) => setForm((prev) => ({ ...prev, icon }))}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <SpinnerIcon className="animate-spin" />
                    Saving…
                  </>
                ) : editing ? (
                  "Save category"
                ) : (
                  "Create category"
                )}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {categories.length === 0 ? (
                <AdminEmpty>No categories yet.</AdminEmpty>
              ) : (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-5 py-3.5">
                      <span className="mr-2 text-lg">{category.icon || "📌"}</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {category.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                          category.type === "income"
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900"
                            : "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900"
                        }`}
                      >
                        {titleCase(category.type)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(category)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <EditIcon />
                          Edit
                        </button>
                        <ConfirmDeleteButton
                          onDelete={() => handleDelete(category)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
