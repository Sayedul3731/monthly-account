import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof colors) {
  if (!process.stdout.isTTY) return text;

  return `${colors[color]}${text}${colors.reset}`;
}

function getStatusColor(statusCode: number): keyof typeof colors {
  if (statusCode >= 500) return 'red';
  if (statusCode >= 400) return 'yellow';
  if (statusCode >= 300) return 'cyan';
  return 'green';
}

function getDurationColor(elapsedMs: number): keyof typeof colors {
  if (elapsedMs >= 1_000) return 'red';
  if (elapsedMs >= 500) return 'yellow';
  return 'green';
}

/**
 * Logs one line after every HTTP response so the duration includes validation,
 * authentication, controller work, and response serialization.
 */
export function requestTimingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const startedAt = process.hrtime.bigint();
  const requestId = randomUUID();
  response.setHeader('X-Request-ID', requestId);

  response.once('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const matchedRoute = request.route as { path?: string } | undefined;
    const route = matchedRoute?.path ?? request.path;
    const requestDetails = `[API] ${request.method} ${route}`;
    const status = String(response.statusCode);
    const duration = `${elapsedMs.toFixed(1)}ms`;

    if (response.statusCode >= 500) {
      console.error(
        JSON.stringify({
          event: 'http_server_error',
          requestId,
          method: request.method,
          route,
          status: response.statusCode,
          durationMs: Math.round(elapsedMs),
        }),
      );
    }
    console.log(
      `${colorize(requestDetails, 'cyan')} ${colorize(status, getStatusColor(response.statusCode))} ${colorize(duration, getDurationColor(elapsedMs))}`,
    );
  });

  next();
}
