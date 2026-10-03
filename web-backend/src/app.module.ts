import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { dataSourceOptions } from './database/data-source';
import { ResourcesModule } from './resources/resources.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Connect to PostgreSQL using the settings from data-source.ts.
    TypeOrmModule.forRoot(dataSourceOptions),
    UsersModule,
    AuthModule,
    ResourcesModule,
    BookingsModule,
  ],
})
export class AppModule {}
