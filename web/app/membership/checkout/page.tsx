import type { Metadata } from "next";
import CheckoutPage from "@/components/CheckoutPage";

export const metadata: Metadata = {
  title: "Checkout · Daily Hisab",
  description: "Review a selected Daily Hisab membership plan.",
};

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
