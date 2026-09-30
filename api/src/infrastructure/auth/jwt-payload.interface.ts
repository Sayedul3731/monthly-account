export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RefreshJwtPayload {
  sub: string;
  type: 'refresh';
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  membershipType?: string;
  trialEndsAt?: Date | null;
  planEndsAt?: Date | null;
}
