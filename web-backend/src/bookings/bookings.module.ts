import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resource } from '../resources/entities/resource.entity';
import { User } from '../users/entities/user.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Resource, User])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
