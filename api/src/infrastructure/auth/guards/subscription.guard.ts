import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipType } from '../../../modules/memberships/membership-type.enum';
import { DefaultRole } from '../../../modules/roles/app-role.schema';
import { SUBSCRIPTION_EXEMPT_KEY } from '../decorators/subscription-exempt.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../jwt-payload.interface';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SUBSCRIPTION_EXEMPT_KEY,
      [context.getHandler(), context.getClass()],
    );
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip || isPublic) return true;

    const user = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>().user;
    if (user?.role === String(DefaultRole.ADMIN)) return true;

    const now = new Date();
    const isPremiumActive =
      user.membershipType === String(MembershipType.PAID) &&
      !!user.planEndsAt &&
      user.planEndsAt > now;
    const isTrialActive =
      user.membershipType === String(MembershipType.FREE) &&
      !!user.trialEndsAt &&
      user.trialEndsAt > now;

    if (isPremiumActive || isTrialActive) return true;

    throw new ForbiddenException(
      'Your 15-day trial or Premium plan has ended. Choose Premium to continue.',
    );
  }
}
