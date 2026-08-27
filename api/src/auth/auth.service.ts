import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { User, UserDocument } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { RefreshJwtPayload } from './jwt-payload.interface';

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

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<User> {
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
}
