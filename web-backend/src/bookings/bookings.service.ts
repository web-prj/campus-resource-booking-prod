import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { Resource } from '../resources/entities/resource.entity';
import { User } from '../users/entities/user.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';

/** Today's date on campus as "YYYY-MM-DD" (the server itself may run in UTC). */
function todayOnCampus(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Create a new confirmed booking for the student. */
  async create(requesterId: string, dto: CreateBookingDto): Promise<Booking> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }
    // "YYYY-MM-DD" strings sort like dates, so we can compare them directly.
    if (dto.date < todayOnCampus()) {
      throw new BadRequestException('You cannot book a date in the past.');
    }

    // Make sure the user really exists (e.g. it was not deleted).
    const userExists = await this.users.existsBy({ id: requesterId });
    if (!userExists) {
      throw new NotFoundException('User not found. Please log in again.');
    }

    // Check for clashes and save in one transaction, with the room row locked.
    // If two students book the same room at the same moment, the second one
    // waits here until the first is saved, so they cannot both get the slot.
    const savedId = await this.bookings.manager.transaction(async (manager) => {
      const room = await manager.findOne(Resource, {
        where: { id: dto.resourceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!room) throw new NotFoundException('Room not found');

      // Two bookings overlap when each one starts before the other ends.
      const clash = await manager.existsBy(Booking, {
        resourceId: room.id,
        date: dto.date,
        status: BookingStatus.CONFIRMED,
        startTime: LessThan(dto.endTime),
        endTime: MoreThan(dto.startTime),
      });
      if (clash) {
        throw new ConflictException(
          'This room is already booked at that time. Please pick another time.',
        );
      }

      const booking = manager.create(Booking, {
        resourceId: room.id,
        requesterId,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: BookingStatus.CONFIRMED,
      });
      return (await manager.save(booking)).id;
    });

    // Reload so the response includes the room and building.
    return (await this.findOne(requesterId, savedId)) as Booking;
  }

  /** All of the student's bookings, newest first. */
  findAll(requesterId: string): Promise<Booking[]> {
    return this.bookings.find({
      where: { requesterId },
      relations: { resource: { building: true } },
      order: { createdAt: 'DESC' },
    });
  }

  /** One booking owned by the student, or null. */
  findOne(requesterId: string, id: string): Promise<Booking | null> {
    return this.bookings.findOne({
      where: { id, requesterId },
      relations: { resource: { building: true } },
    });
  }

  /** Cancel one of the student's bookings. */
  async cancel(requesterId: string, id: string): Promise<Booking> {
    const booking = await this.findOne(requesterId, id);
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancelledAt = new Date();
    return this.bookings.save(booking);
  }
}
