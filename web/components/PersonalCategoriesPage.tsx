"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deletePersonalCategory, fetchCategories, fetchMe, logoutUser, updatePersonalCategory, type ApiCategory } from "@/lib/api";
import { isAdmin, type AuthUser } from "@/lib/auth";
import { getOfflineLookups, saveOfflineLookups } from "@/lib/offline-ledger";
import AppHeader from "./AppHeader";
import CategoryCreator from "./CategoryCreator";
import LoadingState from "./LoadingState";

export default function PersonalCategoriesPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([fetchMe(), fetchCategories()]).then(([account, items]) => {
      if (active) { setUser(account); setCategories(items); }
    }).catch((cause) => {
      if (!active) return;
      if (cause?.status === 401) router.replace("/login");
      else setError(cause instanceof Error ? cause.message : "Could not load categories.");
    });
    return () => { active = false; };
  }, [router]);

  function updateCatalog(items: ApiCategory[]) {
    setCategories(items);
    if (!user) return;
    const cached = getOfflineLookups(user.id);
    if (cached) saveOfflineLookups(user.id, items, cached.transactionTypes);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true); setError("");
    try {
      const saved = await updatePersonalCategory(editing, { name, icon });
      updateCatalog(categories.map((category) => category.id === saved.id ? saved : category));
      setEditing(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save category."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleteId || busy) return;
    setBusy(true); setError("");
    try {
      await deletePersonalCategory(deleteId);
      updateCatalog(categories.filter((category) => category.id !== deleteId));
      setDeleteId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete category."); }
    finally { setBusy(false); }
  }

  const button = "rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700";
  return <div className="min-h-screen bg-paper dark:bg-zinc-950">
    <AppHeader signedIn={Boolean(user)} ready={Boolean(user)} user={user} isAdmin={isAdmin(user)} onSignOut={async () => { await logoutUser(); router.replace("/login"); }} />
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Link href="/" className="text-sm text-brand dark:text-gold">Back to dashboard</Link>
      <h1 className="text-2xl font-semibold">Categories</h1>
      <p className="text-sm text-zinc-500">Your personal categories are private. Shared categories are managed by administrators. Categories used by saved records or budgets keep their name and type; you can change their icon.</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950">{error}</p>}
      {!user && !error && <LoadingState label="Loading categories" />}
      {user && <>
        <div className="grid gap-4 sm:grid-cols-2">{(["expense", "income"] as const).map((type) => <section key={type} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">New {type} category</h2>
          <CategoryCreator type={type} disabled={busy} onCreated={(category) => updateCatalog([...categories, category])} />
        </section>)}</div>
        <ul className="space-y-3">{categories.map((category) => <li key={category.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {editing === category.id ? <form onSubmit={save} className="space-y-3">
            <label className="block text-sm">Name<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 dark:bg-zinc-950" /></label>
            <label className="block text-sm">Icon<input maxLength={10} value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 dark:bg-zinc-950" /></label>
            <div className="flex gap-2"><button disabled={busy} className={button}>Save category</button><button type="button" disabled={busy} onClick={() => setEditing(null)} className={button}>Cancel</button></div>
          </form> : <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-medium">{category.icon} {category.name}</p><p className="text-xs text-zinc-500">{category.type} · {category.userId === user.id ? "Personal" : "Shared"}</p></div>
            {category.userId === user.id && <div className="flex gap-2"><button disabled={busy} onClick={() => { setEditing(category.id); setName(category.name); setIcon(category.icon); setDeleteId(null); setError(""); }} className={button}>Edit</button><button disabled={busy} onClick={() => { setDeleteId(category.id); setError(""); }} className={button}>Delete</button></div>}
          </div>}
          {deleteId === category.id && <div className="mt-4 space-y-2"><p className="text-sm">Delete this unused category?</p><div className="flex gap-2"><button disabled={busy} onClick={() => void remove()} className={button}>Confirm delete</button><button disabled={busy} onClick={() => setDeleteId(null)} className={button}>Cancel</button></div></div>}
        </li>)}</ul>
      </>}
    </main>
  </div>;
}
