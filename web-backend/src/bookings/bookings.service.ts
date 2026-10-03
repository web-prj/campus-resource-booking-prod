import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  CAMPUS_CLOCK,
  CampusClock,
  campusDateTimeMs,
  isFutureCampusTime,
} from '../common/time/campus-clock';
import {
  BOOKING_MAX_DURATION_HOURS,
  clampToBookingWindow,
} from '../common/time/booking-window';
import { ResourceClosure } from '../resources/entities/resource-closure.entity';
import { Resource } from '../resources/entities/resource.entity';
import { ResourceStatus } from '../resources/enums/resource-status.enum';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { BookingDomainError } from './errors/booking-domain.error';

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CAMPUS_CLOCK) private readonly clock: CampusClock,
  ) {}

  async create(requesterId: string, dto: CreateBookingDto): Promise<Booking> {
    this.requireValidRequest(dto);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const resource = await manager
          .getRepository(Resource)
          .createQueryBuilder('resource')
          .setLock('pessimistic_write')
          .where('resource.id = :id', { id: dto.resourceId })
          .getOne();

        if (!resource) {
          throw new BookingDomainError(
            'RESOURCE_NOT_FOUND',
            'Resource not found',
          );
        }

        this.requireOperationalAvailability(resource, dto);

        const closure = await manager.getRepository(ResourceClosure).existsBy({
          resourceId: resource.id,
          date: dto.date,
        });
        if (closure) {
          throw new BookingDomainError(
            'RESOURCE_UNAVAILABLE',
            'The resource is closed on the selected date',
          );
        }

        const newBooking = manager.getRepository(Booking).create({
          resourceId: resource.id,
          requesterId,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: BookingStatus.CONFIRMED,
        });
        return manager.getRepository(Booking).save(newBooking);
      });
    } catch (error: unknown) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
          constraint?: string;
        };
        if (
          driverError.code === '23P01' &&
          driverError.constraint === 'EXCL_bookings_resource_period_blocking'
        ) {
          throw new BookingDomainError(
            'BOOKING_OVERLAP',
            'The selected time overlaps another booking',
          );
        }
      }
      throw error;
    }
  }

  async findForStudent(requesterId: string): Promise<{
    upcoming: Booking[];
    history: Booking[];
    evaluatedAt: Date;
  }> {
    const bookings = await this.dataSource.getRepository(Booking).find({
      where: { requesterId },
      relations: { resource: { building: true } },
      order: { date: 'ASC', startTime: 'ASC', createdAt: 'ASC' },
    });
    const now = this.clock();
    const upcoming: Booking[] = [];
    const history: Booking[] = [];

    for (const booking of bookings) {
      if (this.isActiveForStudent(booking, now)) upcoming.push(booking);
      else history.push(booking);
    }
    history.sort((left, right) =>
      this.bookingStart(right).localeCompare(this.bookingStart(left)),
    );
    return { upcoming, history, evaluatedAt: now };
  }

  currentTime(): Date {
    return this.clock();
  }

  async findOneForStudent(
    requesterId: string,
    bookingId: string,
  ): Promise<Booking | null> {
    return this.dataSource.getRepository(Booking).findOne({
      where: { id: bookingId, requesterId },
      relations: { resource: { building: true } },
    });
  }

  async cancel(requesterId: string, bookingId: string): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const lockedBooking = await this.lockStudentBooking(
        manager,
        requesterId,
        bookingId,
      );
      if (!lockedBooking) {
        throw new BookingDomainError('BOOKING_NOT_FOUND', 'Booking not found');
      }
      const now = this.clock();
      if (!this.canCancel(lockedBooking, now)) {
        throw new BookingDomainError(
          'BOOKING_NOT_CANCELLABLE',
          'Only future confirmed bookings can be cancelled',
        );
      }

      await manager.getRepository(Booking).update(lockedBooking.id, {
        status: BookingStatus.CANCELLED,
        cancelledAt: now,
      });
      return (await manager.getRepository(Booking).findOne({
        where: { id: lockedBooking.id },
        relations: { resource: { building: true } },
      })) as Booking;
    });
  }

  canCancel(booking: Booking, now: Date = this.clock()): boolean {
    return (
      booking.status === BookingStatus.CONFIRMED &&
      isFutureCampusTime(booking.date, booking.startTime.slice(0, 5), now)
    );
  }

  hasEnded(booking: Booking, now: Date = this.clock()): boolean {
    return now.getTime() >= this.bookingEndMs(booking);
  }

  private isActiveForStudent(booking: Booking, now: Date): boolean {
    return (
      booking.status === BookingStatus.CONFIRMED &&
      now.getTime() < this.bookingEndMs(booking)
    );
  }

  private bookingEndMs(booking: Booking): number {
    return campusDateTimeMs(booking.date, booking.endTime.slice(0, 5));
  }

  private bookingStart(booking: Booking): string {
    return `${booking.date}T${booking.startTime.slice(0, 5)}`;
  }

  private lockStudentBooking(
    manager: EntityManager,
    requesterId: string,
    bookingId: string,
  ): Promise<Booking | null> {
    return manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .setLock('pessimistic_write')
      .where('booking.id = :bookingId', { bookingId })
      .andWhere('booking.requesterId = :requesterId', { requesterId })
      .getOne();
  }

  private requireValidRequest(dto: CreateBookingDto): void {
    const [year, month, day] = dto.date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BookingDomainError(
        'INVALID_BOOKING_DATE',
        'Booking date must be a real calendar date',
      );
    }
    if (dto.startTime >= dto.endTime) {
      throw new BookingDomainError(
        'INVALID_BOOKING_RANGE',
        'Booking start time must be before end time',
      );
    }

    // Whole-hour "HH:00" strings, so the span is simply the hour difference.
    const durationHours =
      Number(dto.endTime.slice(0, 2)) - Number(dto.startTime.slice(0, 2));
    if (durationHours > BOOKING_MAX_DURATION_HOURS) {
      throw new BookingDomainError(
        'BOOKING_TOO_LONG',
        `A booking may not exceed ${BOOKING_MAX_DURATION_HOURS} hours`,
      );
    }

    if (!isFutureCampusTime(dto.date, dto.startTime, this.clock())) {
      throw new BookingDomainError(
        'BOOKING_IN_PAST',
        'Booking start time must be in the future',
      );
    }
  }

  private requireOperationalAvailability(
    resource: Resource,
    dto: CreateBookingDto,
  ): void {
    const [year, month, day] = dto.date.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    // Intersect the resource hours with the campus booking window (08:00–18:00)
    // so a resource with wider hours can still only be booked inside it.
    const { open: opensAt, close: closesAt } = clampToBookingWindow(
      resource.opensAt.slice(0, 5),
      resource.closesAt.slice(0, 5),
    );

    if (
      resource.status !== ResourceStatus.ACTIVE ||
      !resource.operatingDays.includes(weekday) ||
      dto.startTime < opensAt ||
      dto.endTime > closesAt
    ) {
      throw new BookingDomainError(
        'RESOURCE_UNAVAILABLE',
        'The resource is not operational for the selected interval',
      );
    }
  }
}
