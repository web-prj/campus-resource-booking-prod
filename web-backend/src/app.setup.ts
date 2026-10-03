import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppConfig } from './config';
import { setupSwagger } from './swagger';

export interface AppSetupOptions {
  enableShutdownHooks?: boolean;
  enableSwagger?: boolean;
}

/** Shared HTTP pipeline for bootstrap. */
export function configureApp(
  app: NestExpressApplication,
  appConfig: AppConfig,
  options: AppSetupOptions = {},
): void {
  app.setGlobalPrefix(appConfig.apiPrefix);
  app.use(helmet());

  if (appConfig.isProduction) {
    app.set('trust proxy', 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({ origin: appConfig.corsOrigins });

  if (options.enableSwagger) {
    setupSwagger(app, appConfig.apiPrefix);
  }

  if (options.enableShutdownHooks) {
    app.enableShutdownHooks();
  }
}
