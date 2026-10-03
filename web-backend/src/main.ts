import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All routes live under /api (e.g. http://localhost:18320/api/resources).
  app.setGlobalPrefix('api');

  // Let the Next.js frontend call the API from the browser.
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:18321')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins });

  // Validate request bodies against the DTOs and strip unknown fields.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Simple API docs at /api/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Campus Room Booking API')
    .setDescription('Book and cancel campus rooms.')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = Number(process.env.PORT ?? 18320);
  await app.listen(port);
}

bootstrap();
