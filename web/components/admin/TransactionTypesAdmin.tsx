"use client";

import { useEffect, useState } from "react";
import {
  createTransactionType,
  deleteTransactionType,
  fetchTransactionTypes,
  updateTransactionType,
  type ApiTransactionType,
} from "@/lib/api";
import { CloseIcon, EditIcon, PlusIcon, SpinnerIcon } from "../icons";
import {
  AdminAlert,
  AdminEmpty,
  ConfirmDeleteButton,
  EmojiPicker,
  fieldClass,
} from "./ui";

const TYPE_ICONS = ["💰", "💸", "💳", "🏦", "📊", "📈", "📉", "📌"];

type FormState = {
  name: string;
  label: string;
  icon: string;
};

const EMPTY_FORM: FormState = { name: "", label: "", icon: "📌" };

type Props = {
  onError: (message: string) => void;
};

export default function TransactionTypesAdmin({ onError }: Props) {
  const [types, setTypes] = useState<ApiTransactionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiTransactionType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setTypes(await fetchTransactionTypes());
      } catch (err) {
        if (!cancelled) {
          onError(
            err instanceof Error
              ? err.message
              : "Failed to load transaction types",
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
    setLabelError(null);
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function openEdit(type: ApiTransactionType) {
    setEditing(type);
    setForm({
      name: type.name,
      label: type.label,
      icon: type.icon || "📌",
    });
    setNameError(null);
    setLabelError(null);
    setFormError(null);
    setSuccess(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setNameError(null);
    setLabelError(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    const name = form.name.trim().toLowerCase();
    const label = form.label.trim();
    let hasError = false;
    if (!name) {
      setNameError("Enter a type name.");
      hasError = true;
    }
    if (!label) {
      setLabelError("Enter a label.");
      hasError = true;
    }
    if (hasError) return;

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateTransactionType(editing.id, {
          name,
          label,
          icon: form.icon,
        });
        setTypes((prev) =>
          prev.map((type) => (type.id === updated.id ? updated : type)),
        );
        setSuccess(`Updated ${updated.label}.`);
      } else {
        const created = await createTransactionType({
          name,
          label,
          icon: form.icon,
        });
        setTypes((prev) => [...prev, created]);
        setSuccess(`Created ${created.label}.`);
      }
      closeForm();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save transaction type";
      if (/already exists|conflict/i.test(message)) {
        setNameError(message);
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type: ApiTransactionType) {
    try {
      await deleteTransactionType(type.id);
      setTypes((prev) => prev.filter((entry) => entry.id !== type.id));
      if (editing?.id === type.id) closeForm();
      setSuccess(`Deleted ${type.label}.`);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Failed to delete transaction type",
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
            Transaction types
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Names should stay stable (for example income or expense) so existing
            data still matches.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <PlusIcon />
          Add type
        </button>
      </div>

      {success && <AdminAlert kind="success">{success}</AdminAlert>}

      {formOpen && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {editing ? "Edit type" : "New type"}
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
                maxLength={50}
                placeholder="income"
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
                Label
              </label>
              <input
                value={form.label}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, label: e.target.value }));
                  setLabelError(null);
                }}
                className={fieldClass(Boolean(labelError))}
                maxLength={50}
                placeholder="Income"
                required
              />
              {labelError && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {labelError}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Icon
              </label>
              <EmojiPicker
                value={form.icon}
                options={TYPE_ICONS}
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
                  "Save type"
                ) : (
                  "Create type"
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
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {types.length === 0 ? (
                <AdminEmpty>No transaction types yet.</AdminEmpty>
              ) : (
                types.map((type) => (
                  <tr key={type.id}>
                    <td className="px-5 py-3.5">
                      <span className="mr-2 text-lg">{type.icon || "📌"}</span>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {type.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {type.name}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(type)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <EditIcon />
                          Edit
                        </button>
                        <ConfirmDeleteButton
                          onDelete={() => handleDelete(type)}
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
