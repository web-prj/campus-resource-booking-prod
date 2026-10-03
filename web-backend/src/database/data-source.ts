import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load the .env file so both the app and the TypeORM CLI can read the settings.
loadEnv();

// One place that describes how to connect to PostgreSQL. The app (app.module.ts)
// and the migration commands both use this.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 18322),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'web_backend',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // The database schema is created by migrations, so never auto-sync.
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
