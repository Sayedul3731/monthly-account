import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import { AppModule } from './app/app.module';

const expressApp = express();

let cachedApp: any;

async function bootstrapServer() {
  if (cachedApp) return cachedApp;

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  const config = app.get(ConfigService);

  const nodeEnv = config.get<string>('nodeEnv', 'development');
  const frontendUrl = config.get<string>('frontendUrl', 'http://localhost:3000');
  const swaggerEnabled = nodeEnv !== 'production';

  const productionOrigins = frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: nodeEnv === 'production' ? productionOrigins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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
        .setTitle('Daily Hisab API')
        .setDescription('API for tracking monthly income and expenses')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  await app.init();
  cachedApp = expressApp;
  return expressApp;
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