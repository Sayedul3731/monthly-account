import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, mergeMap } from 'rxjs';
import type { AuthenticatedUser } from '../../infrastructure/auth/jwt-payload.interface';
import { DefaultRole } from '../roles/app-role.schema';
import { AuditService } from './audit.service';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Records successful privileged writes without retaining request bodies or IPs. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const actor = request.user;
    const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);
    if (!isWrite || actor?.role !== DefaultRole.ADMIN) return next.handle();

    const route = request.route as { path?: string } | undefined;
    const resource =
      `${request.method} ${request.baseUrl}${route?.path ?? request.path}`.slice(
        0,
        255,
      );
    return next.handle().pipe(
      mergeMap(async (result) => {
        try {
          await this.auditService.record({
            actorId: actor.userId,
            action: 'privileged_write',
            resource,
            statusCode: response.statusCode,
          });
        } catch (error) {
          // Audit storage must not turn a successful business operation into a failure.
          this.logger.error('Unable to persist privileged audit event', error);
        }
        return result;
      }),
    );
  }
}
