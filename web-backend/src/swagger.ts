import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Campus Resource Booking API')
    .setDescription('Room reservations for students.')
    .setVersion('1.0')
    .build();
}

/**
 * Interactive docs at `/{prefix}/docs`. Registered outside production so the
 * schema is not published publicly.
 */
export function setupSwagger(app: INestApplication, apiPrefix: string): void {
  const config = createSwaggerConfig();

  SwaggerModule.setup(
    `${apiPrefix}/docs`,
    app,
    SwaggerModule.createDocument(app, config),
  );
}
