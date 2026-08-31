import type { Metadata } from "next";
import ProfilePage from "@/components/ProfilePage";

export const metadata: Metadata = {
  title: "Profile · Daily Hisab",
  description: "View and update your Daily Hisab profile.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
