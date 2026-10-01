import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type {
  NextFunction,
  Request,
  Response,
} from 'express';
import { AppModule } from './app/app.module';
import { requestTimingMiddleware } from './shared/middleware/request-timing.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Vercel sits one trusted proxy hop in front of this serverless app. This
  // lets rate limiting use the client address instead of the platform proxy.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', process.env.VERCEL === '1' ? 1 : false);
  const config = app.get(ConfigService);

  const nodeEnv = config.get<string>('nodeEnv', 'development');
  const frontendUrl = config.get<string>(
    'frontendUrl',
    'http://localhost:3000',
  );
  const swaggerEnabled = nodeEnv !== 'production';

  const productionOrigins = frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: nodeEnv === 'production' ? productionOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (nodeEnv === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
    }
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    next();
  });

  app.use(requestTimingMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Doinik Hisab API')
        .setDescription('API for tracking monthly income and expenses')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  // Vercel's NestJS runtime detects this conventional bootstrap and manages
  // it as a single Vercel Function. Locally it starts a normal HTTP server.
  await app.listen(process.env.PORT || 3001);
}

void bootstrap().catch((error: unknown) => {
  // Vercel's generic FUNCTION_INVOCATION_FAILED page hides the application
  // error from users. Keep the detailed cause in the function logs.
  console.error('API bootstrap failed', error);
  process.exitCode = 1;
});
