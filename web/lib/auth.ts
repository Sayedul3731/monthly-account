export type BillingInterval = "monthly" | "quarterly" | "yearly";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  onboardingStatus?: "pending" | "completed" | "skipped";
  onboardingStep?: number;
  onboardingPeriod?: string | null;
  role?: { id: string; name: string };
  billingInterval?: BillingInterval | null;
  trialStartedAt?: string;
  trialEndsAt?: string;
  planStartedAt?: string;
  planEndsAt?: string;
  cancelledAt?: string;
  membership?: {
    id: string;
    name: string;
    type: "free" | "paid";
    monthlyPrice: number;
    quarterlyPrice: number;
    yearlyPrice: number;
    description?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  csrfToken: string;
  user: AuthUser;
};

const SESSION_KEY = "daily_hisab_session";
const CSRF_TOKEN_KEY = "daily_hisab_csrf_token";
const USER_KEY = "daily_hisab_user";

/**
 * Compatibility helper for UI auth gates. It is only a non-sensitive session
 * hint; the actual access token is held in an HttpOnly API cookie.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function getCsrfToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CSRF_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthSession(
  user: AuthUser,
  csrfToken: string,
): void {
  localStorage.setItem(SESSION_KEY, "authenticated");
  localStorage.setItem(CSRF_TOKEN_KEY, csrfToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CSRF_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role?.name?.toLowerCase() === "admin";
}

export function needsOnboarding(user: AuthUser | null | undefined): boolean {
  return user?.onboardingStatus === "pending" && !isAdmin(user);
}

export function signedInDestination(user: AuthUser): string {
  return needsOnboarding(user) ? "/onboarding" : "/";
}
