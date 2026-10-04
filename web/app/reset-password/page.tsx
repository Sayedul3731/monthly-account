import type { Metadata } from "next";
import AuthLayout from "@/components/AuthLayout";
import PasswordRecoveryForm from "@/components/PasswordRecoveryForm";

export const metadata: Metadata = { title: "Reset your password", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <AuthLayout headline="Set a new password" subtext="Use your email link to recover access securely."><PasswordRecoveryForm reset /></AuthLayout>;
}
