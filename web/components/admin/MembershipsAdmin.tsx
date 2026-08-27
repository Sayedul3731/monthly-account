"use client";

import { useEffect, useState } from "react";
import {
  createMembershipPlan,
  deleteMembershipPlan,
  fetchMemberships,
  updateMembershipPlan,
  type Membership,
  type MembershipType,
} from "@/lib/api";
import { formatCurrency } from "@/lib/finance";
import { CloseIcon, EditIcon, PlusIcon, SpinnerIcon } from "../icons";
import {
  AdminAlert,
  AdminEmpty,
  ConfirmDeleteButton,
  fieldClass,
  titleCase,
} from "./ui";

type FormState = {
  name: string;
  type: MembershipType;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  type: "free",
  description: "",
  monthlyPrice: "0",
  yearlyPrice: "0",
};

type Props = {
  onError: (message: string) => void;
};

export default function MembershipsAdmin({ onError }: Props) {
  const [plans, setPlans] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPlans(await fetchMemberships());
      } catch (err) {
        if (!cancelled) {
          onError(
            err instanceof Error ? err.message : "Failed to load memberships",
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

  function openEdit(plan: Membership) {
    setEditing(plan);
    setForm({
      name: plan.name,
      type: plan.type,
      description: plan.description ?? "",
      monthlyPrice: String(plan.monthlyPrice),
      yearlyPrice: String(plan.yearlyPrice),
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
      setNameError("Enter a plan name.");
      return;
    }

    const monthlyPrice = Number(form.monthlyPrice);
    const yearlyPrice = Number(form.yearlyPrice);
    if (
      !Number.isFinite(monthlyPrice) ||
      monthlyPrice < 0 ||
      !Number.isFinite(yearlyPrice) ||
      yearlyPrice < 0
    ) {
      setFormError("Prices must be zero or greater.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updated = await updateMembershipPlan(editing.id, {
          name,
          type: form.type,
          description: form.description,
          monthlyPrice,
          yearlyPrice,
        });
        setPlans((prev) =>
          prev.map((plan) => (plan.id === updated.id ? updated : plan)),
        );
        setSuccess(`Updated the ${updated.name} plan.`);
      } else {
        const created = await createMembershipPlan({
          name,
          type: form.type,
          description: form.description,
          monthlyPrice,
          yearlyPrice,
        });
        setPlans((prev) => [...prev, created]);
        setSuccess(`Created the ${created.name} plan.`);
      }
      closeForm();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save membership",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan: Membership) {
    try {
      await deleteMembershipPlan(plan.id);
      setPlans((prev) => prev.filter((entry) => entry.id !== plan.id));
      if (editing?.id === plan.id) closeForm();
      setSuccess(`Deleted the ${plan.name} plan.`);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to delete membership",
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
            Memberships
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Only one free plan and one paid plan can exist at a time.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <PlusIcon />
          Add plan
        </button>
      </div>

      {success && <AdminAlert kind="success">{success}</AdminAlert>}

      {formOpen && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
              {editing ? "Edit plan" : "New plan"}
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
                    type: e.target.value as MembershipType,
                  }))
                }
                className={fieldClass(false)}
              >
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className={fieldClass(false)}
                maxLength={255}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Monthly price (USD)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.monthlyPrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, monthlyPrice: e.target.value }))
                }
                className={fieldClass(false)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Yearly price (USD)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.yearlyPrice}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, yearlyPrice: e.target.value }))
                }
                className={fieldClass(false)}
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
                  "Save plan"
                ) : (
                  "Create plan"
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
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Price</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {plans.length === 0 ? (
                <AdminEmpty>No membership plans yet.</AdminEmpty>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-5 py-3.5 font-semibold text-zinc-900 dark:text-white">
                      {plan.name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                          plan.type === "paid"
                            ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
                            : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
                        }`}
                      >
                        {titleCase(plan.type)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {plan.type === "free" ? (
                        "Free"
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {formatCurrency(plan.monthlyPrice)} / month
                          </span>
                          <span>
                            {formatCurrency(plan.yearlyPrice)} / year
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="max-w-[16rem] px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                      {plan.description || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(plan)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <EditIcon />
                          Edit
                        </button>
                        <ConfirmDeleteButton
                          onDelete={() => handleDelete(plan)}
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
