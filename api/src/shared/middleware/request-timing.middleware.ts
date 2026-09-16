import { NextFunction, Request, Response } from 'express';

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

  response.once('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = request.route?.path ?? request.path;
    const requestDetails = `[API] ${request.method} ${route}`;
    const status = String(response.statusCode);
    const duration = `${elapsedMs.toFixed(1)}ms`;

    console.log(
      `${colorize(requestDetails, 'cyan')} ${colorize(status, getStatusColor(response.statusCode))} ${colorize(duration, getDurationColor(elapsedMs))}`,
    );
  });

  next();
}
