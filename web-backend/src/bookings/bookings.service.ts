import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from '../resources/entities/resource.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(Resource)
    private readonly resources: Repository<Resource>,
  ) {}

  /** Create a new confirmed booking for the student. */
  async create(requesterId: string, dto: CreateBookingDto): Promise<Booking> {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const room = await this.resources.findOneBy({ id: dto.resourceId });
    if (!room) throw new NotFoundException('Room not found');

    const booking = this.bookings.create({
      resourceId: room.id,
      requesterId,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: BookingStatus.CONFIRMED,
    });
    const saved = await this.bookings.save(booking);

    // Reload so the response includes the room and building.
    return (await this.findOne(requesterId, saved.id)) as Booking;
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
