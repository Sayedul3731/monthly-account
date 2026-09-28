import { validateRuntimeSecurityConfig } from './security-config.validation';

const accessSecret = 'a-unique-production-access-secret-12345';
const refreshSecret = 'a-different-production-refresh-secret-12345';

describe('validateRuntimeSecurityConfig', () => {
  it('rejects missing JWT secrets in production', () => {
    expect(() =>
      validateRuntimeSecurityConfig({ nodeEnv: 'production' }),
    ).toThrow('JWT_SECRET');
  });

  it('rejects shared JWT secrets in production', () => {
    expect(() =>
      validateRuntimeSecurityConfig({
        nodeEnv: 'production',
        jwtSecret: accessSecret,
        jwtRefreshSecret: accessSecret,
      }),
    ).toThrow('must be different');
  });

  it('accepts distinct, sufficiently long production secrets', () => {
    expect(() =>
      validateRuntimeSecurityConfig({
        nodeEnv: 'production',
        jwtSecret: accessSecret,
        jwtRefreshSecret: refreshSecret,
      }),
    ).not.toThrow();
  });
});
