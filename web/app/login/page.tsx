import type { Metadata } from "next";
import AuthLayout from "@/components/AuthLayout";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · AyBey",
  description: "Sign in to AyBey to manage your finances.",
};

export default function LoginPage() {
  return (
    <AuthLayout
      headline="Your money, month by month."
      subtext="Sign in to review transactions, check budgets, and keep your books in one place."
    >
      <LoginForm />
    </AuthLayout>
  );
}
