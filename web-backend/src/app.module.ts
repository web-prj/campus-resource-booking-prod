import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { BookingsModule } from './bookings/bookings.module';
import { configurations, envValidationSchema } from './config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ResourcesModule } from './resources/resources.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true, ttl: 300000 }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: configurations,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
    ResourcesModule,
    BookingsModule,
  ],
})
export class AppModule {}
