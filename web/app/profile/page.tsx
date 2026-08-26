import type { Metadata } from "next";
import ProfilePage from "@/components/ProfilePage";

export const metadata: Metadata = {
  title: "Profile · My Monthly Account",
  description: "View and update your My Monthly Account profile.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
