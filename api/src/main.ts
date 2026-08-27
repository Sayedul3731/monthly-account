import { setServers } from 'node:dns';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Node.js on Windows (v22–v24 LTS) can fail mongodb+srv SRV lookups with
// querySrv ECONNREFUSED. Force public resolvers before Mongoose connects.
setServers(['1.1.1.1', '8.8.8.8']);

const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  const config = app.get(ConfigService);

  const port = config.get<number>('port', 3001);
  const nodeEnv = config.get<string>('nodeEnv', 'development');
  const frontendUrl = config.get<string>(
    'frontendUrl',
    'http://localhost:3000',
  );
  const swaggerEnabled = nodeEnv !== 'production';

  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Ensures @Exclude()-marked fields (e.g. User.password) are stripped from
  // every response, not just controllers that opt in individually.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  if (swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('AyBey API')
        .setDescription('API for tracking monthly income and expenses')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  console.log(`  ${dim('API')}         : ${cyan(baseUrl)}`);
  if (swaggerEnabled) {
    console.log(`  ${dim('Swagger')}     : ${yellow(`${baseUrl}/docs`)}`);
  }
}

void bootstrap();
