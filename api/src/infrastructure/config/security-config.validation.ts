const UNSAFE_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'dev-refresh-secret-change-me',
  'replace-with-a-long-random-secret',
  'replace-with-a-different-long-random-secret',
]);

type RuntimeSecurityConfig = {
  nodeEnv: string;
  jwtSecret?: string;
  jwtRefreshSecret?: string;
};

/**
 * Production must never start with a secret that is absent, predictable, or
 * shared by access and refresh tokens. Development defaults stay available
 * for local onboarding only.
 */
export function validateRuntimeSecurityConfig({
  nodeEnv,
  jwtSecret,
  jwtRefreshSecret,
}: RuntimeSecurityConfig): void {
  if (nodeEnv !== 'production') return;

  const secrets = [
    ['JWT_SECRET', jwtSecret],
    ['JWT_REFRESH_SECRET', jwtRefreshSecret],
  ] as const;

  for (const [name, value] of secrets) {
    if (!value || value.length < 32 || UNSAFE_JWT_SECRETS.has(value)) {
      throw new Error(
        `${name} must be a unique, high-entropy value of at least 32 characters in production.`,
      );
    }
  }

  if (jwtSecret === jwtRefreshSecret) {
    throw new Error(
      'JWT_SECRET and JWT_REFRESH_SECRET must be different in production.',
    );
  }
}
