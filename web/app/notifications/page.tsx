import type { Metadata } from "next";
import NotificationsPage from "@/components/NotificationsPage";

export const metadata: Metadata = {
  title: "Notifications · Doinik Hisab",
  description: "View account and payment notifications.",
};

export default function NotificationsRoute() {
  return <NotificationsPage />;
}
