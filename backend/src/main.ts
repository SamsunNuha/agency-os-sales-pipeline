import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 5001;
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  // ── Global Prefix ────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin: [frontendUrl],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Global Validation Pipe ───────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Exception Filter ──────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global Response Interceptor ──────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ── Swagger / OpenAPI ────────────────────────────────────
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Agency OS — Sales Pipeline API')
      .setDescription('Production-grade Sales Pipeline & Deal Management REST API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .addTag('auth', 'Authentication endpoints')
      .addTag('deals', 'Deal CRUD and lifecycle management')
      .addTag('pipelines', 'Pipeline and stage management')
      .addTag('follow-ups', 'Deal follow-up management')
      .addTag('probability', 'Deal probability analysis')
      .addTag('dashboard', 'Sales dashboard statistics')
      .addTag('handoff', 'Won deal → project handoff')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`Backend running on http://localhost:${port}/api`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
