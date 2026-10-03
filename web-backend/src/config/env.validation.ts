import * as Joi from 'joi';
import {
  DEFAULT_API_PREFIX,
  DEFAULT_CORS_ORIGINS,
  DEFAULT_DB_PORT,
  DEFAULT_PORT,
} from './defaults';

/**
 * Every variable the app reads is declared here, so a missing or malformed
 * value fails at boot rather than at the first request that needs it.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(DEFAULT_PORT),
  API_PREFIX: Joi.string().default(DEFAULT_API_PREFIX),
  CORS_ORIGINS: Joi.string().default(DEFAULT_CORS_ORIGINS),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(DEFAULT_DB_PORT),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
}).custom((value, helpers) => {
  if (value.NODE_ENV !== 'development' && value.DB_SYNCHRONIZE) {
    return helpers.message({
      custom:
        'DB_SYNCHRONIZE=true is allowed only in development; use reviewed migrations elsewhere.',
    });
  }

  return value;
});
