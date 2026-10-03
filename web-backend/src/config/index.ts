import { ConfigType } from '@nestjs/config';
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';

/** Single place to register namespaces, so adding one is a one-line change. */
export const configurations = [appConfig, databaseConfig];

export type AppConfig = ConfigType<typeof appConfig>;
export type DatabaseConfig = ConfigType<typeof databaseConfig>;

export { appConfig, APP_CONFIG_KEY } from './app.config';
export { databaseConfig, DATABASE_CONFIG_KEY } from './database.config';
export {
  DEFAULT_API_PREFIX,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_PORT,
} from './defaults';
export { envValidationSchema } from './env.validation';
