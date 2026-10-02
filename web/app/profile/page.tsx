import type { Metadata } from "next";
import ProfilePage from "@/components/ProfilePage";

export const metadata: Metadata = {
  title: "Profile · প্রতিদিনের হিসাব",
  description: "View and update your প্রতিদিনের হিসাব profile.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
