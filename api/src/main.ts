import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { AppModule } from './app/app.module';
import { requestTimingMiddleware } from './shared/middleware/request-timing.middleware';

const expressApp = express();
// Vercel sits one trusted proxy hop in front of this serverless handler. This
// lets rate limiting use the client address instead of the platform proxy.
expressApp.set('trust proxy', process.env.VERCEL === '1' ? 1 : false);

let appPromise: Promise<typeof expressApp> | undefined;

async function bootstrapServer() {
  if (appPromise) return appPromise;

  appPromise = (async () => {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );
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
    allowedHeaders: ['Content-Type', 'Authorization'],
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

    await app.init();
    return expressApp;
  })().catch((error: unknown) => {
    appPromise = undefined;
    throw error;
  });

  return appPromise;
}

// Local dev: run a normal server
if (process.env.VERCEL !== '1') {
  bootstrapServer().then((server) => {
    const port = process.env.PORT || 3001;
    server.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
    });
  });
}

// Vercel: export a serverless handler
export default async function handler(req: any, res: any) {
  const server = await bootstrapServer();
  server(req, res);
}
