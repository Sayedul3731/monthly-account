import type { Metadata } from "next";
import MembershipsPage from "@/components/MembershipsPage";

export const metadata: Metadata = {
  title: "Membership · Daily Hisab",
  description: "View and switch between Free and Paid membership plans.",
};

export default function MembershipRoute() {
  return <MembershipsPage />;
}
