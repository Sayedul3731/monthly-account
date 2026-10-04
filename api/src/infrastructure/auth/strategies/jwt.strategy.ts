import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../../modules/users/users.service';
import { readCookie } from '../cookies';
import { AuthenticatedUser, JwtPayload } from '../jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request | undefined) =>
          readCookie(request?.headers?.cookie, 'daily_hisab_access_token') ??
          null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    try {
      const user = await this.usersService.findOne(payload.sub);
      if ((payload.version ?? 0) !== (user.authenticationVersion ?? 0)) {
        throw new UnauthorizedException('Session revoked. Sign in again.');
      }
      if (!user.role?.name) {
        throw new UnauthorizedException('User role is unavailable');
      }

      return {
        userId: user.id,
        email: user.email,
        role: user.role.name,
        membershipType: user.membership?.type,
        trialEndsAt: user.trialEndsAt,
        planEndsAt: user.planEndsAt,
      };
    } catch {
      throw new UnauthorizedException('User account is no longer active');
    }
  }
}
