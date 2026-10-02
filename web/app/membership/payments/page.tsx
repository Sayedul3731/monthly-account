import type { Metadata } from "next";
import PaymentVerificationPage from "@/components/PaymentVerificationPage";

export const metadata: Metadata = {
  title: "Payment verification · প্রতিদিনের হিসাব",
  description: "Track your Nagad payment verification status and Premium access.",
};

export default function MembershipPaymentsRoute() {
  return <PaymentVerificationPage />;
}
