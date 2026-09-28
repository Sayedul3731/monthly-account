import type { Metadata } from "next";
import ProfilePage from "@/components/ProfilePage";

export const metadata: Metadata = {
  title: "Profile · Doinik Hisab",
  description: "View and update your Doinik Hisab profile.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
