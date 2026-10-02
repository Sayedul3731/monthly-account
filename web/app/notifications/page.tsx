import type { Metadata } from "next";
import NotificationsPage from "@/components/NotificationsPage";

export const metadata: Metadata = {
  title: "Notifications · Protidiner Hisab",
  description: "View account and payment notifications.",
};

export default function NotificationsRoute() {
  return <NotificationsPage />;
}
