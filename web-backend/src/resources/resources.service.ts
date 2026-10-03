import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../bookings/enums/booking-status.enum';
import {
  CAMPUS_CLOCK,
  CampusClock,
  campusDateOf,
  campusTimeOf,
  isFutureCampusTime,
} from '../common/time/campus-clock';
import {
  DiscoverResourcesQueryDto,
  ResourceSort,
} from './dto/discover-resources-query.dto';
import { Building } from './entities/building.entity';
import { ResourceClosure } from './entities/resource-closure.entity';
import { Resource } from './entities/resource.entity';
import { ResourceStatus } from './enums/resource-status.enum';

/** Booking statuses that still hold a slot and therefore block availability. */
const BLOCKING_STATUSES = [BookingStatus.CONFIRMED];

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private readonly resourcesRepository: Repository<Resource>,
    @InjectRepository(Building)
    private readonly buildingsRepository: Repository<Building>,
    @Inject(CAMPUS_CLOCK) private readonly clock: CampusClock,
  ) {}

  findBuildings(): Promise<Building[]> {
    return this.buildingsRepository.find({ order: { name: 'ASC' } });
  }

  currentTime(): Date {
    return this.clock();
  }

  async discover(
    query: DiscoverResourcesQueryDto,
  ): Promise<[Resource[], number]> {
    const now = this.clock();
    let todayStartTime: string | undefined;
    if (query.date) {
      this.requireValidDate(query.date);
      if (query.startTime && query.endTime) {
        this.requireValidInterval(query.date, query.startTime, query.endTime);
        if (!isFutureCampusTime(query.date, query.startTime, now)) {
          return [[], 0];
        }
      } else {
        // Full-day results cannot include an operating day already underway.
        const today = campusDateOf(now);
        if (query.date < today) return [[], 0];
        if (query.date === today) todayStartTime = campusTimeOf(now);
      }
    }

    return this.resourcesRepository.manager.transaction(
      'REPEATABLE READ',
      (manager) =>
        this.discoverFrom(
          manager.getRepository(Resource),
          query,
          todayStartTime,
        ),
    );
  }

  private discoverFrom(
    repository: Repository<Resource>,
    query: DiscoverResourcesQueryDto,
    todayStartTime?: string,
  ): Promise<[Resource[], number]> {
    const builder = repository
      .createQueryBuilder('resource')
      .innerJoinAndSelect('resource.building', 'building')
      .where('resource.status = :status', { status: ResourceStatus.ACTIVE });

    if (query.q) {
      builder.andWhere(
        '(resource.name ILIKE :search OR resource.code ILIKE :search OR resource.location ILIKE :search OR building.name ILIKE :search OR building.code ILIKE :search)',
        { search: `%${this.escapeLike(query.q)}%` },
      );
    }
    if (query.buildingId) {
      builder.andWhere('resource.buildingId = :buildingId', {
        buildingId: query.buildingId,
      });
    }
    if (query.minCapacity !== undefined) {
      builder.andWhere('resource.capacity >= :minCapacity', {
        minCapacity: query.minCapacity,
      });
    }
    if (query.amenity) {
      builder.andWhere(':amenity = ANY(resource.amenities)', {
        amenity: query.amenity,
      });
    }
    if (query.date) {
      const dayOfWeek = this.dayOfWeekFor(query.date);
      const isInterval = Boolean(query.startTime && query.endTime);
      builder.andWhere(':dayOfWeek = ANY(resource.operatingDays)', {
        dayOfWeek,
      });
      if (todayStartTime) {
        builder.andWhere('resource.opensAt > :todayStartTime', {
          todayStartTime,
        });
      }
      if (isInterval) {
        builder
          .andWhere('resource.opensAt <= :startTime', {
            startTime: query.startTime,
          })
          .andWhere('resource.closesAt >= :endTime', {
            endTime: query.endTime,
          });
      }
      builder
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM resource_closures closure
            WHERE closure.resource_id = resource.id
              AND closure.date = :availabilityDate
          )`,
          { availabilityDate: query.date },
        )
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM bookings booking
            WHERE booking.resource_id = resource.id
              AND booking.booking_date = :availabilityDate
              AND booking.status IN (:...blockingStatuses)
              ${isInterval ? 'AND booking.start_time < :endTime AND booking.end_time > :startTime' : ''}
          )`,
          {
            ...(isInterval && {
              endTime: query.endTime,
              startTime: query.startTime,
            }),
            blockingStatuses: BLOCKING_STATUSES,
          },
        );
    }

    if (query.sort === ResourceSort.CAPACITY_ASC) {
      builder.orderBy('resource.capacity', 'ASC');
    } else if (query.sort === ResourceSort.CAPACITY_DESC) {
      builder.orderBy('resource.capacity', 'DESC');
    } else {
      builder.orderBy('resource.name', 'ASC');
    }

    return builder
      .addOrderBy('resource.code', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
  }

  async findDiscoverableById(id: string): Promise<Resource | null> {
    return this.resourcesRepository.findOne({
      where: { id, status: ResourceStatus.ACTIVE },
      relations: { building: true },
    });
  }

  async findAvailabilitySnapshot(
    resourceId: string,
    date: string,
  ): Promise<{
    resource: Resource;
    closure: ResourceClosure | null;
    bookings: Booking[];
  } | null> {
    this.requireValidDate(date);
    return this.resourcesRepository.manager.transaction(
      'REPEATABLE READ',
      async (manager) => {
        const resource = await manager
          .getRepository(Resource)
          .findOne({ where: { id: resourceId } });
        if (!resource) return null;

        const closure = await manager
          .getRepository(ResourceClosure)
          .findOneBy({ resourceId, date });
        const bookings = await manager.getRepository(Booking).find({
          where: BLOCKING_STATUSES.map((status) => ({
            resourceId,
            date,
            status,
          })),
          order: { startTime: 'ASC' },
        });

        return { resource, closure, bookings };
      },
    );
  }

  private requireValidInterval(
    date: string,
    startTime: string,
    endTime: string,
  ): void {
    this.requireValidDate(date);
    if (startTime >= endTime) throw new InvalidAvailabilityRangeError();
  }

  private requireValidDate(date: string): void {
    const [year, month, day] = date.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new InvalidAvailabilityDateError();
    }
  }

  private dayOfWeekFor(date: string): number {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }
}

export class InvalidAvailabilityDateError extends Error {
  constructor() {
    super('Availability date must be a real calendar date');
    this.name = 'InvalidAvailabilityDateError';
  }
}

export class InvalidAvailabilityRangeError extends Error {
  constructor() {
    super('Availability start time must be before end time');
    this.name = 'InvalidAvailabilityRangeError';
  }
}
