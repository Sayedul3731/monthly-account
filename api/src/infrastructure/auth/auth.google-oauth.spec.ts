import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { UsersService } from '../../modules/users/users.service';
import type { SmtpMailerService } from './smtp-mailer.service';

jest.mock('../../modules/users/users.service', () => ({
  UsersService: class UsersService {},
}));

import { AuthService } from './auth.service';

describe('Google OAuth state', () => {
  const secret = 'isolated-oauth-state-test-secret';
  let service: AuthService;
  let jwt: JwtService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const users = {
    findOrCreateGoogleUser: jest.fn(),
    createOAuthHandoff: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T12:00:00Z'));
    jest.clearAllMocks();
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected provider request'));
    jwt = new JwtService();
    service = new AuthService(
      users as unknown as UsersService,
      jwt,
      new ConfigService({
        jwt: { secret },
        oauth: {
          google: {
            clientId: 'isolated-client',
            clientSecret: 'isolated-secret',
            callbackUrl: 'https://web.example/api/auth/google/callback',
          },
        },
      }),
      {} as SmtpMailerService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('issues distinct states for simultaneous sign-in attempts with a ten-minute expiry', () => {
    const attempts = Array.from({ length: 10 }, () =>
      service.createGoogleAuthorization(),
    );
    expect(new Set(attempts.map(({ state }) => state)).size).toBe(10);
    for (const { state, authorizationUrl } of attempts) {
      const payload = jwt.verify<{
        purpose: string;
        nonce: string;
        iat: number;
        exp: number;
      }>(state, { secret });
      expect(payload.purpose).toBe('google-oauth-state');
      expect(payload.nonce).toMatch(/^[a-f0-9]{64}$/);
      expect(payload.exp - payload.iat).toBe(600);
      expect(new URL(authorizationUrl).searchParams.get('state')).toBe(state);
    }
  });

  it('accepts a valid state only when the initiating browser cookie matches', async () => {
    const { state } = service.createGoogleAuthorization();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'isolated-provider-token' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sub: 'google-user',
            email: 'verified@example.com',
            email_verified: true,
            name: 'Verified user',
          }),
          { status: 200 },
        ),
      );
    users.findOrCreateGoogleUser.mockResolvedValue({ id: 'user-1' });
    users.createOAuthHandoff.mockResolvedValue('single-use-handoff');
    await expect(
      service.completeGoogleOAuth('provider-code', state, state),
    ).resolves.toBe('single-use-handoff');
    expect(users.findOrCreateGoogleUser).toHaveBeenCalledWith({
      googleId: 'google-user',
      email: 'verified@example.com',
      name: 'Verified user',
    });
  });

  it('rejects a different browser state before contacting Google', async () => {
    const first = service.createGoogleAuthorization();
    const second = service.createGoogleAuthorization();
    await expect(
      service.completeGoogleOAuth('provider-code', first.state, second.state),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(users.findOrCreateGoogleUser).not.toHaveBeenCalled();
  });

  it('rejects callbacks without the initiating browser cookie', async () => {
    const { state } = service.createGoogleAuthorization();
    await expect(
      service.completeGoogleOAuth('provider-code', state, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects expired states before contacting Google', async () => {
    const { state } = service.createGoogleAuthorization();
    jest.advanceTimersByTime(11 * 60_000);
    await expect(
      service.completeGoogleOAuth('provider-code', state, state),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures even when the state matches the cookie', async () => {
    const state = jwt.sign(
      { purpose: 'google-oauth-state', nonce: 'a'.repeat(64) },
      { secret: 'different-signing-secret', expiresIn: '10m' },
    );
    await expect(
      service.completeGoogleOAuth('provider-code', state, state),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'invalid-nonce', 123])(
    'rejects signed legacy or malformed nonce %p',
    async (nonce) => {
      const state = jwt.sign(
        { purpose: 'google-oauth-state', nonce },
        { secret, expiresIn: '10m' },
      );
      await expect(
        service.completeGoogleOAuth('provider-code', state, state),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
