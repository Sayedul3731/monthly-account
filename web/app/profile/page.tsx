import type { Metadata } from "next";
import ProfilePage from "@/components/ProfilePage";

export const metadata: Metadata = {
  title: "Profile · AyBey",
  description: "View and update your AyBey profile.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
