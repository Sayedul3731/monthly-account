import type { Metadata } from "next";
import AuthLayout from "@/components/AuthLayout";
import RegisterForm from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "Create account · AyBey",
  description:
    "Create a free AyBey account to track income, expenses, and budgets.",
};

export default function RegisterPage() {
  return (
    <AuthLayout
      headline="Take control of every month."
      subtext="See where your money goes, plan ahead with budgets, and keep a clean history of every transaction."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
