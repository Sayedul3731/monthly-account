import { validateRuntimeSecurityConfig } from './security-config.validation';

export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  validateRuntimeSecurityConfig({
    nodeEnv,
    jwtSecret,
    jwtRefreshSecret: refreshSecret,
  });

  return {
    port: parseInt(process.env.PORT ?? '3001', 10),
    apiUrl: process.env.API_URL ?? 'http://localhost:3001',
    nodeEnv,
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    database: {
      uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/daily_hisab',
      dnsServers: (process.env.MONGODB_DNS_SERVERS ?? '')
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean),
    },
    jwt: {
      secret: jwtSecret ?? 'dev-secret-change-me',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
      refreshSecret: refreshSecret ?? 'dev-refresh-secret-change-me',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.GOOGLE_CALLBACK_URL,
      },
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
    },
    payments: {
      nagadNumber: process.env.NAGAD_PAYMENT_NUMBER?.trim() ?? '',
    },
  };
};
