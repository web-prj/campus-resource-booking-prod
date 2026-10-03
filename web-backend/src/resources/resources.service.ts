import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resource } from './entities/resource.entity';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private readonly resources: Repository<Resource>,
  ) {}

  /** All rooms, with their building, sorted by name. */
  findAll(): Promise<Resource[]> {
    return this.resources.find({
      relations: { building: true },
      order: { name: 'ASC' },
    });
  }

  /** One room by id, or null if it does not exist. */
  findOne(id: string): Promise<Resource | null> {
    return this.resources.findOne({
      where: { id },
      relations: { building: true },
    });
  }
}
