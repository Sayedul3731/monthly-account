import type { Metadata } from "next";
import CheckoutPage from "@/components/CheckoutPage";

export const metadata: Metadata = {
  title: "Checkout · Doinik Hisab",
  description: "Review a selected Doinik Hisab membership plan.",
};

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
