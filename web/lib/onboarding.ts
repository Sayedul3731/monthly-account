import type { Budget } from "./api";
import type { Transaction } from "./finance";

export const ONBOARDING_STEPS = [
  "স্বাগতম",
  "মাসিক আয়",
  "মাসের বাজেট",
  "প্রথম খরচ",
  "আপনার হিসাব",
];

export const CATEGORY_LABELS: Record<string, string> = {
  Salary: "বেতন",
  Freelance: "ফ্রিল্যান্স",
  Investment: "বিনিয়োগ",
  Gift: "উপহার",
  Food: "খাবার",
  Transport: "যাতায়াত",
  Bills: "বিল",
  Shopping: "কেনাকাটা",
  Health: "স্বাস্থ্য",
  Entertainment: "বিনোদন",
  Other: "অন্যান্য",
};

export function parseOnboardingAmount(input: string): number | null {
  const normalized = input
    .replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)))
    .replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) &&
    amount >= 0.01 &&
    Number.isSafeInteger(Math.round(amount * 100))
    ? amount
    : null;
}

export function summarizeOnboarding(
  transactions: Transaction[],
  budgets: Budget[],
) {
  const incomeCents = transactions
    .filter((entry) => entry.type === "income")
    .reduce((total, entry) => total + Math.round(entry.amount * 100), 0);
  const spentCents = transactions
    .filter((entry) => entry.type === "expense")
    .reduce((total, entry) => total + Math.round(entry.amount * 100), 0);
  const budget = budgets.find((entry) => entry.category === "")?.amount ?? null;
  const remaining =
    budget === null ? null : (Math.round(budget * 100) - spentCents) / 100;
  return {
    income: incomeCents / 100,
    spent: spentCents / 100,
    budget,
    remaining,
  };
}

export function onboardingDate(period: string, today: string): string {
  return today.slice(0, 7) === period ? today : `${period}-01`;
}

export function onboardingErrorMessage(error: unknown, online = true): string {
  const detail = typeof error === "object" && error !== null ? error : {};
  const message =
    "message" in detail && typeof detail.message === "string"
      ? detail.message
      : "";
  const status =
    "status" in detail && typeof detail.status === "number"
      ? detail.status
      : undefined;
  const network = "kind" in detail && detail.kind === "network";
  if (network)
    return online
      ? "অ্যাপের সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।"
      : "আপনি অফলাইনে আছেন। ইন্টারনেট সংযোগ ফিরলে আবার চেষ্টা করুন।";
  if (/trial.*ended|Premium plan has ended/i.test(message))
    return "আপনার ট্রায়াল বা প্ল্যানের মেয়াদ শেষ হয়েছে। সেটআপ বাদ দিয়ে সদস্যপদ পাতা থেকে প্ল্যান বেছে নিতে পারেন।";
  if (/already finished/i.test(message))
    return "সেটআপ ইতোমধ্যে শেষ হয়েছে। ড্যাশবোর্ড থেকে লেনদেন পরিবর্তন করুন।";
  if (/csrf/i.test(message))
    return "সেশনের নিরাপত্তা তথ্য মেলেনি। পাতাটি রিফ্রেশ করে আবার চেষ্টা করুন।";
  if (status === 401) return "সেশনের মেয়াদ শেষ হয়েছে। আবার সাইন ইন করুন।";
  if (status === 403)
    return "এই কাজের অনুমতি পাওয়া যায়নি। আপনার সেশন ও সদস্যপদ পরীক্ষা করুন।";
  if (status === 404)
    return "এই তথ্য বা সুবিধাটি পাওয়া যায়নি। পাতাটি রিফ্রেশ করে আবার চেষ্টা করুন।";
  if (status === 429)
    return "অল্প সময়ে অনেক অনুরোধ হয়েছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।";
  if (status !== undefined && status >= 500)
    return "সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
  if (/valid date|month being set up/i.test(message))
    return "যে মাসের হিসাব তৈরি করছেন, সেই মাসের একটি সঠিক তারিখ বেছে নিন।";
  if (/category|transaction type/i.test(message))
    return "লেনদেনের ক্যাটাগরি বা ধরন মেলেনি। সঠিক আয়ের উৎস বা খরচের ক্যাটাগরি বেছে নিন।";
  if (status === 400)
    return "দেওয়া তথ্য গ্রহণ করা যায়নি। টাকার পরিমাণ, ক্যাটাগরি ও তারিখ পরীক্ষা করুন।";
  return "তথ্য লোড বা সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।";
}
