import type { Metadata } from "next";
import CheckoutPage from "@/components/CheckoutPage";

export const metadata: Metadata = {
  title: "Checkout · প্রতিদিনের হিসাব",
  description: "Review a selected প্রতিদিনের হিসাব membership plan.",
};

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
