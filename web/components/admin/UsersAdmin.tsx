"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createUser,
  deleteUser,
  fetchMemberships,
  fetchRoles,
  fetchUsers,
  updateUser,
  type AdminUser,
  type AppRole,
  type BillingInterval,
  type Membership,
} from "@/lib/api";
import { CloseIcon, EditIcon, EyeIcon, EyeOffIcon, PlusIcon, SpinnerIcon } from "../icons";
import {
  AdminAlert,
  AdminEmpty,
  ConfirmDeleteButton,
  fieldClass,
  formatShortDate,
  titleCase,
} from "./ui";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

type FormState = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  membershipId: string;
  billingInterval: BillingInterval;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  membershipId: "",
  billingInterval: "monthly",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

type Props = {
  currentUserId: string;
  onError: (message: string) => void;
};

function paidMembership(memberships: Membership[], id: string): boolean {
  return memberships.find((plan) => plan.id === id)?.type === "paid";
}

export default function UsersAdmin({ currentUserId, onError }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [nextUsers, nextRoles, nextMemberships] = await Promise.all([
          fetchUsers(),
          fetchRoles(),
          fetchMemberships(),
        ]);
        if (cancelled) return;
        setUsers(nextUsers);
        setRoles(nextRoles);
        setMemberships(nextMemberships);
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : "Failed to load users");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const haystack = [
        user.name,
        user.email,
        user.role?.name,
        user.membership?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, search]);

  const isPaid = paidMembership(memberships, form.membershipId);

  function openCreate() {
    const userRole = roles.find((role) => role.name === "user");
    const freePlan = memberships.find((plan) => plan.type === "free");
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      roleId: userRole?.id ?? roles[0]?.id ?? "",
      membershipId: freePlan?.id ?? memberships[0]?.id ?? "",
    });
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setShowPassword(false);
    setFormOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      roleId: user.roleId || user.role?.id || "",
      membershipId: user.membershipId || user.membership?.id || "",
      billingInterval: user.billingInterval === "yearly" ? "yearly" : "monthly",
    });
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setShowPassword(false);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setFormError(null);
    setShowPassword(false);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = "Enter a name.";
    else if (form.name.trim().length < 2) errors.name = "Name is too short.";

    if (!form.email.trim()) errors.email = "Enter an email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }

    if (!editing) {
      if (!form.password) errors.password = "Choose a password.";
      else if (form.password.length < MIN_PASSWORD_LENGTH) {
        errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      } else if (form.password.length > MAX_PASSWORD_LENGTH) {
        errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
      }
    } else if (form.password) {
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      } else if (form.password.length > MAX_PASSWORD_LENGTH) {
        errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
      }
    }

    if (!form.roleId) errors.roleId = "Select a role.";
    if (!form.membershipId) errors.membershipId = "Select a membership.";
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const paid = paidMembership(memberships, form.membershipId);
      if (editing) {
        const updated = await updateUser(editing.id, {
          name: form.name,
          email: form.email,
          roleId: form.roleId,
          membershipId: form.membershipId,
          billingInterval: paid ? form.billingInterval : undefined,
          ...(form.password ? { password: form.password } : {}),
        });
        setUsers((prev) =>
          prev.map((user) => (user.id === updated.id ? updated : user)),
        );
        setSuccess(`Updated ${updated.name}.`);
      } else {
        const created = await createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          roleId: form.roleId,
          membershipId: form.membershipId,
          billingInterval: paid ? form.billingInterval : undefined,
        });
        setUsers((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setSuccess(`Created ${created.name}.`);
      }
      closeForm();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save user";
      if (/already in use|already exists|conflict/i.test(message)) {
        setFieldErrors((prev) => ({
          ...prev,
          email: "An account with this email already exists.",
        }));
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: AdminUser) {
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((entry) => entry.id !== user.id));
      if (editing?.id === user.id) closeForm();
      setSuccess(`Deleted ${user.name}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete user");
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
            Users
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Create accounts and assign roles or memberships.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <PlusIcon />
          Add user
        </button>
      </div>

      {success && <AdminAlert kind="success">{success}</AdminAlert>}

      {formOpen && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {editing ? "Edit user" : "New user"}
              </h3>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {editing
                  ? "Leave the password blank to keep the current one."
                  : "The user can sign in immediately after you create the account."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close form"
            >
              <CloseIcon />
            </button>
          </div>

          {formError && <AdminAlert kind="error">{formError}</AdminAlert>}

          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Full name
              </label>
              <input
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                className={fieldClass(Boolean(fieldErrors.name))}
                maxLength={100}
                required
              />
              {fieldErrors.name && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, email: e.target.value }));
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                className={fieldClass(Boolean(fieldErrors.email))}
                maxLength={255}
                required
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {editing ? "New password (optional)" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, password: e.target.value }));
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  className={`${fieldClass(Boolean(fieldErrors.password))} pr-12`}
                  minLength={editing ? undefined : MIN_PASSWORD_LENGTH}
                  maxLength={MAX_PASSWORD_LENGTH}
                  placeholder={
                    editing
                      ? "Leave blank to keep current"
                      : `At least ${MIN_PASSWORD_LENGTH} characters`
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Role
              </label>
              <select
                value={form.roleId}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, roleId: e.target.value }));
                  if (fieldErrors.roleId) {
                    setFieldErrors((prev) => ({ ...prev, roleId: undefined }));
                  }
                }}
                className={fieldClass(Boolean(fieldErrors.roleId))}
                required
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {titleCase(role.name)}
                  </option>
                ))}
              </select>
              {fieldErrors.roleId && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.roleId}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Membership
              </label>
              <select
                value={form.membershipId}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    membershipId: e.target.value,
                  }));
                  if (fieldErrors.membershipId) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      membershipId: undefined,
                    }));
                  }
                }}
                className={fieldClass(Boolean(fieldErrors.membershipId))}
                required
              >
                <option value="">Select a plan</option>
                {memberships.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({titleCase(plan.type)})
                  </option>
                ))}
              </select>
              {fieldErrors.membershipId && (
                <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                  {fieldErrors.membershipId}
                </p>
              )}
            </div>
            {isPaid && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Billing interval
                </label>
                <div className="flex gap-2">
                  {(["monthly", "yearly"] as const).map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          billingInterval: interval,
                        }))
                      }
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        form.billingInterval === interval
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {titleCase(interval)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-end gap-2 sm:col-span-2">
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
                  "Save user"
                ) : (
                  "Create user"
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
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, role, or plan…"
            className={fieldClass(false)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Membership</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filtered.length === 0 ? (
                <AdminEmpty>
                  {users.length === 0
                    ? "No users yet."
                    : "No users match your search."}
                </AdminEmpty>
              ) : (
                filtered.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="bg-white dark:bg-zinc-900">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          {user.name}
                          {isSelf && (
                            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                            user.role?.name === "admin"
                              ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
                              : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700"
                          }`}
                        >
                          {titleCase(user.role?.name ?? "user")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-700 dark:text-zinc-300">
                        {user.membership?.name ?? "—"}
                        {user.membership?.type === "paid" &&
                        user.billingInterval
                          ? ` · ${user.billingInterval}`
                          : ""}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-zinc-500 dark:text-zinc-400">
                        {formatShortDate(user.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            <EditIcon />
                            Edit
                          </button>
                          <ConfirmDeleteButton
                            onDelete={() => handleDelete(user)}
                            disabled={isSelf}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
