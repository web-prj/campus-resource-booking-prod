import { envValidationSchema } from './env.validation';

const baseEnv = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'web_backend',
};

const validate = (env: Record<string, unknown>) =>
  envValidationSchema.validate(env, { abortEarly: false });

describe('envValidationSchema', () => {
  it('accepts a minimal valid environment and fills in defaults', () => {
    const { error, value } = validate(baseEnv);

    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 18320,
      API_PREFIX: 'api',
      CORS_ORIGINS: 'http://localhost:18321',
      DB_PORT: 18322,
      DB_SYNCHRONIZE: false,
    });
  });

  it('requires the core database connection fields', () => {
    expect(validate({ ...baseEnv, DB_HOST: undefined }).error).toBeDefined();
    expect(validate({ ...baseEnv, DB_NAME: undefined }).error).toBeDefined();
  });

  it('rejects schema synchronization outside development', () => {
    expect(
      validate({ ...baseEnv, NODE_ENV: 'test', DB_SYNCHRONIZE: true }).error
        ?.message,
    ).toMatch(/allowed only in development/);
    expect(
      validate({ ...baseEnv, NODE_ENV: 'production', DB_SYNCHRONIZE: true })
        .error?.message,
    ).toMatch(/allowed only in development/);
    expect(
      validate({ ...baseEnv, NODE_ENV: 'development', DB_SYNCHRONIZE: true })
        .error,
    ).toBeUndefined();
  });

  it('reports every problem at once, not just the first', () => {
    const { error } = validate({ DB_HOST: 'localhost' });

    expect(error?.details.length).toBeGreaterThan(1);
  });
});
