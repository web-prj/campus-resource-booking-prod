import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThan,
  QueryFailedError,
} from 'typeorm';
import {
  CAMPUS_CLOCK,
  CampusClock,
  campusDateOf,
  campusDateTimeMs,
  campusTimeOf,
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
import { AvailabilityEventsService } from '../events/availability-events.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CAMPUS_CLOCK) private readonly clock: CampusClock,
    private readonly availabilityEvents: AvailabilityEventsService,
  ) {}

  async create(requesterId: string, dto: CreateBookingDto): Promise<Booking> {
    this.requireValidRequest(dto);

    let booking: Booking;
    try {
      booking = await this.dataSource.transaction(async (manager) => {
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
          status: resource.requiresApproval
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
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

    this.availabilityEvents.notifyAvailabilityChanged(
      booking.resourceId,
      booking.date,
    );
    return booking;
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

  async findOperationsForStaff(
    page: number,
    pageSize: number,
  ): Promise<{
    bookings: Booking[];
    total: number;
    evaluatedAt: Date;
    campusDate: string;
  }> {
    const evaluatedAt = this.clock();
    const date = campusDateOf(evaluatedAt);
    const [bookings, total] = await this.dataSource
      .getRepository(Booking)
      .findAndCount({
        where: [
          {
            date: LessThanOrEqual(date),
            status: BookingStatus.CONFIRMED,
          },
          {
            date: LessThanOrEqual(date),
            status: BookingStatus.CHECKED_IN,
          },
        ],
        relations: this.staffRelations(),
        order: { date: 'ASC', startTime: 'ASC', createdAt: 'ASC', id: 'ASC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    return { bookings, total, evaluatedAt, campusDate: date };
  }

  /**
   * Pending requests that can still be reviewed, i.e. whose scheduled end
   * has not passed in campus time. Filtering happens in SQL so `total` and the
   * page boundaries agree with what staff can act on.
   */
  async findPendingForStaff(
    page: number,
    pageSize: number,
  ): Promise<{
    bookings: Booking[];
    total: number;
    evaluatedAt: Date;
  }> {
    const evaluatedAt = this.clock();
    const today = campusDateOf(evaluatedAt);
    const currentTime = campusTimeOf(evaluatedAt);
    const [bookings, total] = await this.dataSource
      .getRepository(Booking)
      .findAndCount({
        where: [
          { status: BookingStatus.PENDING, date: MoreThan(today) },
          {
            status: BookingStatus.PENDING,
            date: today,
            endTime: MoreThan(currentTime),
          },
        ],
        relations: this.staffRelations(),
        order: { createdAt: 'ASC', id: 'ASC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
    return { bookings, total, evaluatedAt };
  }

  async findOneForStaff(bookingId: string): Promise<Booking | null> {
    return this.dataSource.getRepository(Booking).findOne({
      where: { id: bookingId },
      relations: this.staffRelations(),
    });
  }

  async findResourceSchedule(
    resourceId: string,
    date: string,
  ): Promise<{ bookings: Booking[]; evaluatedAt: Date }> {
    const evaluatedAt = this.clock();
    const bookings = await this.dataSource.getRepository(Booking).find({
      where: { resourceId, date },
      relations: this.staffRelations(),
      order: { startTime: 'ASC', createdAt: 'ASC' },
    });
    return { bookings, evaluatedAt };
  }

  async approve(reviewerId: string, bookingId: string): Promise<Booking> {
    const booking = await this.review(
      reviewerId,
      bookingId,
      BookingStatus.CONFIRMED,
      null,
    );
    this.availabilityEvents.notifyAvailabilityChanged(
      booking.resourceId,
      booking.date,
    );
    return booking;
  }

  async reject(
    reviewerId: string,
    bookingId: string,
    reason: string,
  ): Promise<Booking> {
    const booking = await this.review(
      reviewerId,
      bookingId,
      BookingStatus.REJECTED,
      reason,
    );
    this.availabilityEvents.notifyAvailabilityChanged(
      booking.resourceId,
      booking.date,
    );
    return booking;
  }

  async confirmCheckIn(staffId: string, bookingId: string): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const booking = await this.lockBooking(manager, bookingId);
      if (!booking) {
        throw new BookingDomainError('BOOKING_NOT_FOUND', 'Booking not found');
      }
      const now = this.clock();
      if (
        booking.status !== BookingStatus.CONFIRMED ||
        !this.isWithinCheckInWindow(booking, now)
      ) {
        throw new BookingDomainError(
          'CHECK_IN_NOT_AVAILABLE',
          'This booking cannot be checked in now',
        );
      }
      await manager.getRepository(Booking).update(booking.id, {
        status: BookingStatus.CHECKED_IN,
        checkInCode: null,
        checkedInAt: now,
        checkedInById: staffId,
      });
      return this.reloadStaffBooking(manager, booking.id);
    });
  }

  async checkOut(staffId: string, bookingId: string): Promise<Booking> {
    const booking = await this.dataSource.transaction(async (manager) => {
      const lockedBooking = await this.lockBooking(manager, bookingId);
      if (!lockedBooking) {
        throw new BookingDomainError('BOOKING_NOT_FOUND', 'Booking not found');
      }
      if (lockedBooking.status !== BookingStatus.CHECKED_IN) {
        throw new BookingDomainError(
          'BOOKING_NOT_CHECKED_IN',
          'Only checked-in bookings can be checked out',
        );
      }

      await manager.getRepository(Booking).update(lockedBooking.id, {
        status: BookingStatus.COMPLETED,
        checkedOutAt: this.clock(),
        checkedOutById: staffId,
      });
      return this.reloadStaffBooking(manager, lockedBooking.id);
    });
    this.availabilityEvents.notifyAvailabilityChanged(
      booking.resourceId,
      booking.date,
    );
    return booking;
  }

  async markNoShow(staffId: string, bookingId: string): Promise<Booking> {
    const booking = await this.dataSource.transaction(async (manager) => {
      const lockedBooking = await this.lockBooking(manager, bookingId);
      if (!lockedBooking) {
        throw new BookingDomainError('BOOKING_NOT_FOUND', 'Booking not found');
      }
      const now = this.clock();
      if (
        lockedBooking.status !== BookingStatus.CONFIRMED ||
        now.getTime() < this.checkInDeadlineMs(lockedBooking)
      ) {
        throw new BookingDomainError(
          'NO_SHOW_NOT_AVAILABLE',
          'Only a confirmed booking that reached its scheduled end can be marked as a no-show',
        );
      }

      await manager.getRepository(Booking).update(lockedBooking.id, {
        status: BookingStatus.NO_SHOW,
        checkInCode: null,
        noShowAt: now,
        noShowById: staffId,
      });
      return this.reloadStaffBooking(manager, lockedBooking.id);
    });
    this.availabilityEvents.notifyAvailabilityChanged(
      booking.resourceId,
      booking.date,
    );
    return booking;
  }

  /**
   * Closes bookings whose scheduled end has passed without check-in:
   * - a confirmed booking staff have not checked in becomes a no-show with no
   *   staff actor, even if it has a legacy check-in request timestamp;
   * - a request nobody reviewed becomes expired.
   * Neither status holds the slot. History remains available.
   */
  async releaseMissedDeadlines(): Promise<{
    released: number;
    expired: number;
  }> {
    const now = this.clock();
    const released = await this.updatePastDeadline(
      BookingStatus.CONFIRMED,
      { status: BookingStatus.NO_SHOW, noShowAt: now, checkInCode: null },
      now,
    );
    const expired = await this.updatePastDeadline(
      BookingStatus.PENDING,
      { status: BookingStatus.EXPIRED },
      now,
    );

    const changed = new Map<string, { resourceId: string; date: string }>();
    for (const row of [...released, ...expired]) {
      changed.set(`${row.resource_id}:${row.booking_date}`, {
        resourceId: row.resource_id,
        date: row.booking_date,
      });
    }
    for (const { resourceId, date } of changed.values()) {
      this.availabilityEvents.notifyAvailabilityChanged(resourceId, date);
    }
    return { released: released.length, expired: expired.length };
  }

  private async updatePastDeadline(
    from: BookingStatus.CONFIRMED | BookingStatus.PENDING,
    changes: Partial<Booking>,
    now: Date,
  ): Promise<{ resource_id: string; booking_date: string }[]> {
    const result = await this.dataSource
      .getRepository(Booking)
      .createQueryBuilder()
      .update(Booking)
      .set(changes)
      .where('status = :from', { from })
      // Lets the status partial indexes skip every future booking.
      .andWhere('booking_date <= :today', { today: campusDateOf(now) })
      .andWhere(
        `(("booking_date" + "end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh') <= :now`,
        { now },
      )
      .returning(
        `"resource_id", to_char("booking_date", 'YYYY-MM-DD') AS "booking_date"`,
      )
      .execute();
    return result.raw as { resource_id: string; booking_date: string }[];
  }

  async cancel(requesterId: string, bookingId: string): Promise<Booking> {
    const booking = await this.dataSource.transaction(async (manager) => {
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
          'Only future pending or confirmed bookings can be cancelled',
        );
      }

      await manager.getRepository(Booking).update(lockedBooking.id, {
        status: BookingStatus.CANCELLED,
        cancelledAt: now,
        checkInRequestedAt: null,
      });
      return (await manager.getRepository(Booking).findOne({
        where: { id: lockedBooking.id },
        relations: { resource: { building: true } },
      })) as Booking;
    });
    this.availabilityEvents.notifyAvailabilityChanged(
      booking.resourceId,
      booking.date,
    );
    return booking;
  }

  canCancel(booking: Booking, now: Date = this.clock()): boolean {
    return (
      (booking.status === BookingStatus.PENDING ||
        booking.status === BookingStatus.CONFIRMED) &&
      isFutureCampusTime(booking.date, booking.startTime.slice(0, 5), now)
    );
  }

  hasEnded(booking: Booking, now: Date = this.clock()): boolean {
    return now.getTime() >= this.bookingEndMs(booking);
  }

  canReview(booking: Booking, now: Date = this.clock()): boolean {
    return (
      booking.status === BookingStatus.PENDING &&
      now.getTime() < this.checkInDeadlineMs(booking)
    );
  }

  canConfirmCheckIn(booking: Booking, now: Date = this.clock()): boolean {
    return (
      booking.status === BookingStatus.CONFIRMED &&
      this.isWithinCheckInWindow(booking, now)
    );
  }

  canCheckOut(booking: Booking): boolean {
    return booking.status === BookingStatus.CHECKED_IN;
  }

  canMarkNoShow(booking: Booking, now: Date = this.clock()): boolean {
    return (
      booking.status === BookingStatus.CONFIRMED &&
      now.getTime() >= this.checkInDeadlineMs(booking)
    );
  }

  /** The scheduled end, when check-in closes and an unused booking is released. */
  checkInDeadline(booking: Booking): Date {
    return new Date(this.checkInDeadlineMs(booking));
  }

  private async review(
    reviewerId: string,
    bookingId: string,
    status: BookingStatus.CONFIRMED | BookingStatus.REJECTED,
    rejectionReason: string | null,
  ): Promise<Booking> {
    return this.dataSource.transaction(async (manager) => {
      const booking = await manager
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id = :bookingId', { bookingId })
        .getOne();
      if (!booking) {
        throw new BookingDomainError('BOOKING_NOT_FOUND', 'Booking not found');
      }
      if (booking.status !== BookingStatus.PENDING) {
        throw new BookingDomainError(
          'BOOKING_NOT_PENDING',
          'Only pending booking requests can be reviewed',
        );
      }
      const reviewedAt = this.clock();
      if (!this.canReview(booking, reviewedAt)) {
        throw new BookingDomainError(
          'BOOKING_REVIEW_WINDOW_ENDED',
          'This booking request can no longer be reviewed because its scheduled end has passed',
        );
      }

      await manager.getRepository(Booking).update(booking.id, {
        status,
        reviewedAt,
        reviewedById: reviewerId,
        rejectionReason,
      });
      return (await manager.getRepository(Booking).findOne({
        where: { id: booking.id },
        relations: this.staffRelations(),
      })) as Booking;
    });
  }

  private isActiveForStudent(booking: Booking, now: Date): boolean {
    return (
      (booking.status === BookingStatus.PENDING ||
        booking.status === BookingStatus.CONFIRMED ||
        booking.status === BookingStatus.CHECKED_IN) &&
      now.getTime() < this.bookingEndMs(booking)
    );
  }

  private isWithinCheckInWindow(booking: Booking, now: Date): boolean {
    return (
      now.getTime() >= this.bookingStartMs(booking) &&
      now.getTime() < this.checkInDeadlineMs(booking)
    );
  }

  private checkInDeadlineMs(booking: Booking): number {
    return this.bookingEndMs(booking);
  }

  private bookingStartMs(booking: Booking): number {
    return campusDateTimeMs(booking.date, booking.startTime.slice(0, 5));
  }

  private bookingEndMs(booking: Booking): number {
    return campusDateTimeMs(booking.date, booking.endTime.slice(0, 5));
  }

  private staffRelations() {
    return {
      resource: { building: true },
      requester: true,
      reviewer: true,
      checkedInBy: true,
      checkedOutBy: true,
      noShowBy: true,
    } as const;
  }

  private reloadStudentBooking(
    manager: EntityManager,
    bookingId: string,
  ): Promise<Booking> {
    return manager.getRepository(Booking).findOneOrFail({
      where: { id: bookingId },
      relations: { resource: { building: true } },
    });
  }

  private reloadStaffBooking(
    manager: EntityManager,
    bookingId: string,
  ): Promise<Booking> {
    return manager.getRepository(Booking).findOneOrFail({
      where: { id: bookingId },
      relations: this.staffRelations(),
    });
  }

  private lockBooking(
    manager: EntityManager,
    bookingId: string,
  ): Promise<Booking | null> {
    return manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .setLock('pessimistic_write')
      .where('booking.id = :bookingId', { bookingId })
      .getOne();
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
