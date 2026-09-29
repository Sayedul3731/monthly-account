import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readCookie, tokensMatch } from '../cookies';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for authenticated, cookie-based requests.
 * Public authentication endpoints are exempt because they do not depend on an
 * existing session cookie and have dedicated rate limits.
 */
@Injectable()
export class CsrfGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<{
      method: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    if (isPublic || SAFE_METHODS.has(request.method)) return true;

    const header = request.headers['x-csrf-token'];
    const submitted = Array.isArray(header) ? header[0] : header;
    const cookieHeader = request.headers.cookie;
    const cookie = readCookie(
      Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader,
      'daily_hisab_csrf_token',
    );
    if (!tokensMatch(submitted, cookie)) {
      throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
