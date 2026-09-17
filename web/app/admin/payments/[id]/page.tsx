import type { Metadata } from "next";
import PaymentReviewPage from "@/components/admin/PaymentReviewPage";

export const metadata: Metadata = {
  title: "Payment review · Daily Hisab",
  description: "Review a submitted manual payment.",
};

export default function PaymentReviewRoute() {
  return <PaymentReviewPage />;
}
