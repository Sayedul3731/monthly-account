import type { Metadata } from "next";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Admin · AyBey",
  description: "Manage users, roles, memberships, categories, and types.",
};

export default function AdminRoute() {
  return <AdminPanel />;
}
