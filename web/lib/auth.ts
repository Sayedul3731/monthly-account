export type BillingInterval = "monthly" | "quarterly" | "yearly";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role?: { id: string; name: string };
  billingInterval?: BillingInterval | null;
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
  accessToken: string;
  user: AuthUser;
};

const ACCESS_TOKEN_KEY = "daily_hisab_access_token";
const USER_KEY = "daily_hisab_user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
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
  accessToken: string,
  user: AuthUser,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem("daily_hisab_refresh_token");
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role?.name?.toLowerCase() === "admin";
}
