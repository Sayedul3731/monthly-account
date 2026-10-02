import type { Metadata } from "next";
import ProfilePage from "@/components/ProfilePage";

export const metadata: Metadata = {
  title: "Profile · Protidiner Hisab",
  description: "View and update your Protidiner Hisab profile.",
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
