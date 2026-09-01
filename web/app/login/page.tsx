import type { Metadata } from "next";
import AuthLayout from "@/components/AuthLayout";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Daily Hisab",
  description: "আপনার প্রতিদিনের আয়-ব্যয়ের সহজ হিসাব।",
};

export default function LoginPage() {
  return (
    <AuthLayout
      headline="আপনার প্রতিদিনের আয়-ব্যয়ের সহজ হিসাব।"
      subtext="Track your income, expenses, and savings in one simple place."
    >
      <LoginForm />
    </AuthLayout>
  );
}
