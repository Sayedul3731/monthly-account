import type { Metadata } from "next";
import AuthLayout from "@/components/AuthLayout";
import RegisterForm from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "Create your Daily Hisab",
  description:
    "আজ থেকেই আপনার টাকার হিসাব রাখুন।",
};

export default function RegisterPage() {
  return (
    <AuthLayout
      headline="আজ থেকেই আপনার টাকার হিসাব রাখুন।"
      subtext="It only takes a few seconds to get started."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
