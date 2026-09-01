import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { User, UserDocument } from '../../modules/users/user.schema';
import { UsersService } from '../../modules/users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { RefreshJwtPayload } from './jwt-payload.interface';

type GoogleOAuthState = { purpose: 'google-oauth-state' };

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

    if (
      !user?.password ||
      !(await bcrypt.compare(dto.password, user.password))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  createGoogleAuthorization(): { authorizationUrl: string; state: string } {
    const google = this.getGoogleConfig();
    const state = this.jwtService.sign(
      { purpose: 'google-oauth-state' } satisfies GoogleOAuthState,
      {
        secret: this.config.getOrThrow<string>('jwt.secret'),
        expiresIn: '10m',
      },
    );
    const params = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  async completeGoogleOAuth(
    authorizationCode: string | undefined,
    state: string | undefined,
    expectedState: string | undefined,
  ): Promise<string> {
    if (
      !authorizationCode ||
      !state ||
      !expectedState ||
      state !== expectedState
    ) {
      throw new UnauthorizedException('Invalid Google OAuth request');
    }

    try {
      const payload = this.jwtService.verify<GoogleOAuthState>(state, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
      if (payload.purpose !== 'google-oauth-state') {
        throw new UnauthorizedException('Invalid Google OAuth request');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Expired Google OAuth request');
    }

    const profile = await this.getGoogleProfile(authorizationCode);
    const user = await this.usersService.findOrCreateGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name ?? profile.email.split('@')[0],
    });

    return this.usersService.createOAuthHandoff(user.id);
  }

  async exchangeOAuthHandoff(code: string): Promise<AuthResponseDto> {
    const user = await this.usersService.consumeOAuthHandoff(code);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired OAuth sign-in code');
    }

    return this.buildAuthResponse(user);
  }

  googleSuccessRedirectUrl(code: string): string {
    return this.frontendUrl('/login/oauth', { code });
  }

  googleFailureRedirectUrl(): string {
    return this.frontendUrl('/login', { oauthError: 'google' });
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const payload = this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);

    if (
      !user?.refreshToken ||
      !this.matchesRefreshToken(refreshToken, user.refreshToken)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.clearRefreshToken(userId);
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.usersService.findOne(userId);
    return this.toPublicUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.usersService.update(userId, {
      name: dto.name,
      email: dto.email,
      password: dto.password,
      membershipId: dto.membershipId,
      billingInterval: dto.billingInterval,
    });
    return this.toPublicUser(user);
  }

  private toPublicUser(user: UserDocument): User {
    const userJson = user.toJSON() as User;
    Reflect.deleteProperty(userJson, 'password');
    Reflect.deleteProperty(userJson, 'refreshToken');
    return userJson;
  }

  private async buildAuthResponse(
    user: UserDocument,
  ): Promise<AuthResponseDto> {
    if (!user.role?.name) {
      throw new UnauthorizedException('User role is not loaded');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role.name,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' } satisfies RefreshJwtPayload,
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.getOrThrow<string>(
          'jwt.refreshExpiresIn',
        ) as JwtSignOptions['expiresIn'],
      },
    );

    await this.usersService.setRefreshToken(
      user.id,
      this.hashRefreshToken(refreshToken),
    );

    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  private verifyRefreshToken(refreshToken: string): RefreshJwtPayload {
    let payload: RefreshJwtPayload;

    try {
      payload = this.jwtService.verify<RefreshJwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return payload;
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private matchesRefreshToken(token: string, storedHash: string): boolean {
    return this.hashRefreshToken(token) === storedHash;
  }

  private getGoogleConfig(): {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  } {
    const clientId = this.config.get<string>('oauth.google.clientId');
    const clientSecret = this.config.get<string>('oauth.google.clientSecret');
    const callbackUrl = this.config.get<string>('oauth.google.callbackUrl');

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    return { clientId, clientSecret, callbackUrl };
  }

  private async getGoogleProfile(code: string): Promise<GoogleUserInfo> {
    const google = this.getGoogleConfig();
    let tokenResponse: Response;

    try {
      tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: google.clientId,
          client_secret: google.clientSecret,
          redirect_uri: google.callbackUrl,
          grant_type: 'authorization_code',
        }),
      });
    } catch {
      throw new BadGatewayException('Could not reach Google sign-in');
    }

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Google sign-in was not accepted');
    }

    const token = (await tokenResponse.json()) as { access_token?: unknown };
    if (typeof token.access_token !== 'string') {
      throw new BadGatewayException('Google did not return an access token');
    }

    let profileResponse: Response;
    try {
      profileResponse = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${token.access_token}` } },
      );
    } catch {
      throw new BadGatewayException('Could not retrieve your Google profile');
    }

    if (!profileResponse.ok) {
      throw new UnauthorizedException('Could not verify your Google account');
    }

    const profile = (await profileResponse.json()) as Partial<GoogleUserInfo>;
    if (
      typeof profile.sub !== 'string' ||
      typeof profile.email !== 'string' ||
      profile.email_verified !== true
    ) {
      throw new UnauthorizedException('A verified Google email is required');
    }

    return {
      sub: profile.sub,
      email: profile.email,
      email_verified: true,
      name: typeof profile.name === 'string' ? profile.name : undefined,
    };
  }

  private frontendUrl(path: string, params: Record<string, string>): string {
    const frontendUrl = this.config
      .get<string>('frontendUrl', 'http://localhost:3000')
      .split(',')[0]
      .trim();
    const url = new URL(path, frontendUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
}
