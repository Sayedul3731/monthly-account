import type { Metadata } from "next";
import AuthLayout from "@/components/AuthLayout";
import PasswordRecoveryForm from "@/components/PasswordRecoveryForm";

export const metadata: Metadata = { title: "Recover your account", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <AuthLayout headline="Recover your account" subtext="Get back to managing your daily finances."><PasswordRecoveryForm /></AuthLayout>;
}
