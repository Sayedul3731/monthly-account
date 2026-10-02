import type { Metadata } from "next";
import CheckoutPage from "@/components/CheckoutPage";

export const metadata: Metadata = {
  title: "Checkout · Protidiner Hisab",
  description: "Review a selected Protidiner Hisab membership plan.",
};

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
