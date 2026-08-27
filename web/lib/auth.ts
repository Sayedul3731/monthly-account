export type BillingInterval = "monthly" | "yearly";

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
    yearlyPrice: number;
    description?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

const ACCESS_TOKEN_KEY = "monthly_account_access_token";
const REFRESH_TOKEN_KEY = "monthly_account_refresh_token";
const USER_KEY = "monthly_account_user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
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
  refreshToken?: string,
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function updateStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role?.name?.toLowerCase() === "admin";
}
