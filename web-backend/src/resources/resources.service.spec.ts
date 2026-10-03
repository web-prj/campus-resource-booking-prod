import { Repository, SelectQueryBuilder } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Building } from './entities/building.entity';
import { ResourceClosure } from './entities/resource-closure.entity';
import { Resource } from './entities/resource.entity';
import {
  DiscoverResourcesQueryDto,
  ResourceSort,
} from './dto/discover-resources-query.dto';
import { ResourceStatus } from './enums/resource-status.enum';
import { ResourcesService } from './resources.service';

const building = { id: '10000000-0000-4000-8000-000000000001' } as Building;
const resource = {
  id: '20000000-0000-4000-8000-000000000001',
  code: 'ROOM-A101',
  name: 'Study Room A101',
  description: null,
  status: ResourceStatus.ACTIVE,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: '08:00:00',
  closesAt: '18:00:00',
  building,
} as Resource;

describe('ResourcesService', () => {
  let resourcesRepository: jest.Mocked<
    Pick<Repository<Resource>, 'createQueryBuilder' | 'findOne'>
  > & {
    manager: {
      transaction: jest.Mock;
      getRepository: jest.Mock;
    };
  };
  let queryBuilder: jest.Mocked<
    Pick<
      SelectQueryBuilder<Resource>,
      | 'innerJoinAndSelect'
      | 'where'
      | 'andWhere'
      | 'orderBy'
      | 'addOrderBy'
      | 'skip'
      | 'take'
      | 'getManyAndCount'
    >
  >;
  let buildingsRepository: jest.Mocked<Pick<Repository<Building>, 'find'>>;
  let closuresRepository: { findOneBy: jest.Mock };
  let bookingsRepository: { find: jest.Mock };
  let service: ResourcesService;

  beforeEach(() => {
    queryBuilder = {
      innerJoinAndSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      skip: jest.fn(),
      take: jest.fn(),
      getManyAndCount: jest.fn().mockResolvedValue([[resource], 1]),
    };
    for (const method of [
      'innerJoinAndSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ] as const) {
      queryBuilder[method].mockReturnValue(
        queryBuilder as unknown as SelectQueryBuilder<Resource>,
      );
    }

    closuresRepository = { findOneBy: jest.fn().mockResolvedValue(null) };
    bookingsRepository = { find: jest.fn().mockResolvedValue([]) };

    resourcesRepository = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(
          queryBuilder as unknown as SelectQueryBuilder<Resource>,
        ),
      findOne: jest.fn().mockResolvedValue(resource),
      manager: {
        transaction: jest.fn(),
        getRepository: jest.fn(),
      },
    };
    resourcesRepository.manager.getRepository.mockImplementation(
      (entity: unknown) => {
        if (entity === ResourceClosure) {
          return closuresRepository as unknown as Repository<ResourceClosure>;
        }
        if (entity === Booking) {
          return bookingsRepository as unknown as Repository<Booking>;
        }
        return resourcesRepository as unknown as Repository<Resource>;
      },
    );
    resourcesRepository.manager.transaction.mockImplementation(
      async (
        isolationOrOperation: string | ((manager: unknown) => unknown),
        maybeOperation?: (manager: unknown) => unknown,
      ) => {
        const operation =
          typeof isolationOrOperation === 'function'
            ? isolationOrOperation
            : maybeOperation;
        return operation?.(resourcesRepository.manager);
      },
    );
    buildingsRepository = { find: jest.fn().mockResolvedValue([]) };

    service = new ResourcesService(
      resourcesRepository as unknown as Repository<Resource>,
      buildingsRepository as unknown as Repository<Building>,
      () => new Date('2026-09-14T00:00:00.000Z'),
    );
  });

  it('builds an active-only discovery query with filters and paging', async () => {
    const query: DiscoverResourcesQueryDto = {
      q: 'Room_100%',
      buildingId: building.id,
      minCapacity: 6,
      amenity: 'whiteboard',
      sort: ResourceSort.CAPACITY_DESC,
      page: 2,
      pageSize: 9,
    };

    await expect(service.discover(query)).resolves.toEqual([[resource], 1]);
    expect(resourcesRepository.manager.transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function),
    );

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'resource.status = :status',
      { status: ResourceStatus.ACTIVE },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('resource.name ILIKE :search'),
      { search: '%Room\\_100\\%%' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.buildingId = :buildingId',
      { buildingId: building.id },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.capacity >= :minCapacity',
      { minCapacity: 6 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      ':amenity = ANY(resource.amenities)',
      { amenity: 'whiteboard' },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'resource.capacity',
      'DESC',
    );
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      'resource.code',
      'ASC',
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(9);
    expect(queryBuilder.take).toHaveBeenCalledWith(9);
  });

  it('returns no resources for an elapsed campus interval', async () => {
    const elapsedService = new ResourcesService(
      resourcesRepository as unknown as Repository<Resource>,
      buildingsRepository as unknown as Repository<Building>,
      () => new Date('2026-09-15T03:00:00.000Z'),
    );

    await expect(
      elapsedService.discover({
        date: '2026-09-15',
        startTime: '09:00',
        endTime: '10:00',
        sort: ResourceSort.NAME_ASC,
        page: 1,
        pageSize: 9,
      }),
    ).resolves.toEqual([[], 0]);
    expect(resourcesRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it('limits full-day searches for today to resources not yet open', async () => {
    const todayService = new ResourcesService(
      resourcesRepository as unknown as Repository<Resource>,
      buildingsRepository as unknown as Repository<Building>,
      () => new Date('2026-09-15T03:00:00.000Z'),
    );
    await todayService.discover({
      date: '2026-09-15',
      sort: ResourceSort.NAME_ASC,
      page: 1,
      pageSize: 9,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.opensAt > :todayStartTime',
      { todayStartTime: '10:00' },
    );
    queryBuilder.andWhere.mockClear();
    await todayService.discover({
      date: '2026-09-14',
      sort: ResourceSort.NAME_ASC,
      page: 1,
      pageSize: 9,
    });
    expect(resourcesRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(queryBuilder.andWhere).not.toHaveBeenCalled();

    await todayService.discover({
      date: '2026-09-16',
      sort: ResourceSort.NAME_ASC,
      page: 1,
      pageSize: 9,
    });
    expect(resourcesRepository.manager.transaction).toHaveBeenCalledTimes(2);
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'resource.opensAt > :todayStartTime',
      expect.anything(),
    );
  });

  it('filters date-only discovery by operating day, closures and blocking bookings', async () => {
    await service.discover({
      date: '2026-09-15',
      sort: ResourceSort.NAME_ASC,
      page: 1,
      pageSize: 9,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      ':dayOfWeek = ANY(resource.operatingDays)',
      { dayOfWeek: 2 },
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'resource.opensAt <= :startTime',
      expect.anything(),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('resource_closures'),
      { availabilityDate: '2026-09-15' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM bookings booking'),
      { blockingStatuses: ['confirmed'] },
    );
  });

  it('filters discovery by an operational date and interval', async () => {
    await service.discover({
      date: '2026-09-15',
      startTime: '09:00',
      endTime: '11:00',
      sort: ResourceSort.NAME_ASC,
      page: 1,
      pageSize: 9,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      ':dayOfWeek = ANY(resource.operatingDays)',
      { dayOfWeek: 2 },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.opensAt <= :startTime',
      { startTime: '09:00' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'resource.closesAt >= :endTime',
      { endTime: '11:00' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('resource_closures'),
      { availabilityDate: '2026-09-15' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('FROM bookings booking'),
      expect.objectContaining({
        blockingStatuses: ['confirmed'],
      }),
    );
  });

  it.each([
    ['2026-02-30', '09:00', '10:00'],
    ['2026-09-15', '11:00', '10:00'],
    ['2026-09-15', '10:00', '10:00'],
  ])(
    'rejects an invalid availability interval %s %s-%s',
    async (date, startTime, endTime) => {
      await expect(
        service.discover({
          date,
          startTime,
          endTime,
          sort: ResourceSort.NAME_ASC,
          page: 1,
          pageSize: 9,
        }),
      ).rejects.toThrow();
    },
  );

  it('loads availability inputs from one repeatable-read snapshot', async () => {
    const closure = {
      resourceId: resource.id,
      date: '2026-09-15',
    } as ResourceClosure;
    const bookings = [{ id: 'booking-1' }] as Booking[];
    closuresRepository.findOneBy.mockResolvedValue(closure);
    bookingsRepository.find.mockResolvedValue(bookings);

    await expect(
      service.findAvailabilitySnapshot(resource.id, '2026-09-15'),
    ).resolves.toEqual({ resource, closure, bookings });

    expect(resourcesRepository.manager.transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function),
    );
    expect(resourcesRepository.findOne).toHaveBeenCalledWith({
      where: { id: resource.id },
    });
    expect(closuresRepository.findOneBy).toHaveBeenCalledWith({
      resourceId: resource.id,
      date: '2026-09-15',
    });
    expect(bookingsRepository.find).toHaveBeenCalledWith({
      where: [
        { resourceId: resource.id, date: '2026-09-15', status: 'confirmed' },
      ],
      order: { startTime: 'ASC' },
    });
  });

  it('returns no availability snapshot for an unknown resource', async () => {
    resourcesRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findAvailabilitySnapshot(resource.id, '2026-09-15'),
    ).resolves.toBeNull();
    expect(closuresRepository.findOneBy).not.toHaveBeenCalled();
    expect(bookingsRepository.find).not.toHaveBeenCalled();
  });

  it('finds resource details only when they are active', async () => {
    await service.findDiscoverableById(resource.id);

    expect(resourcesRepository.findOne).toHaveBeenCalledWith({
      where: { id: resource.id, status: ResourceStatus.ACTIVE },
      relations: { building: true },
    });
  });

  it('lists buildings ordered by name', async () => {
    await service.findBuildings();
    expect(buildingsRepository.find).toHaveBeenCalledWith({
      order: { name: 'ASC' },
    });
  });
});
