import { ConfigType } from '@nestjs/config';
import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { bookingsConfig } from './bookings.config';
import { bootstrapConfig } from './bootstrap.config';
import { databaseConfig } from './database.config';
import { throttleConfig } from './throttle.config';

/** Single place to register namespaces, so adding one is a one-line change. */
export const configurations = [
  appConfig,
  databaseConfig,
  authConfig,
  throttleConfig,
  bootstrapConfig,
  bookingsConfig,
];

export type AppConfig = ConfigType<typeof appConfig>;
export type DatabaseConfig = ConfigType<typeof databaseConfig>;
export type AuthConfig = ConfigType<typeof authConfig>;
export type ThrottleConfig = ConfigType<typeof throttleConfig>;
export type BootstrapConfig = ConfigType<typeof bootstrapConfig>;
export type BookingsConfig = ConfigType<typeof bookingsConfig>;

export { appConfig, APP_CONFIG_KEY } from './app.config';
export { authConfig, AUTH_CONFIG_KEY } from './auth.config';
export { bookingsConfig, BOOKINGS_CONFIG_KEY } from './bookings.config';
export { bootstrapConfig, BOOTSTRAP_CONFIG_KEY } from './bootstrap.config';
export { databaseConfig, DATABASE_CONFIG_KEY } from './database.config';
export { throttleConfig, THROTTLE_CONFIG_KEY } from './throttle.config';
export {
  DEFAULT_API_PREFIX,
  DEFAULT_AUTH_COOKIE_NAME,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_PORT,
} from './defaults';
export { envValidationSchema } from './env.validation';
