import type { Metadata } from "next";
import OnboardingFlow from "@/components/OnboardingFlow";

export const metadata: Metadata = {
  title: "আপনার মাসিক হিসাব শুরু করুন | Doinik Hisab",
  description: "মাসিক আয়, বাজেট ও প্রথম খরচ যোগ করে আপনার মাসের হিসাব দেখুন।",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
