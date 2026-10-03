import { ApiProperty } from '@nestjs/swagger';
import { Resource } from '../entities/resource.entity';

class BuildingDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ALP' })
  code: string;

  @ApiProperty({ example: 'Alpha Building' })
  name: string;
}

/** The shape of a room sent back to the frontend. */
export class ResourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ALP-101' })
  code: string;

  @ApiProperty({ example: 'Room 101' })
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 'room' })
  type: string;

  @ApiProperty({ example: 30 })
  capacity: number;

  @ApiProperty({ example: 'First floor' })
  location: string;

  @ApiProperty({ type: [String], example: ['projector', 'whiteboard'] })
  amenities: string[];

  @ApiProperty({ type: BuildingDto })
  building: BuildingDto;

  static fromEntity(resource: Resource): ResourceResponseDto {
    return {
      id: resource.id,
      code: resource.code,
      name: resource.name,
      description: resource.description,
      type: resource.type,
      capacity: resource.capacity,
      location: resource.location,
      amenities: resource.amenities,
      building: {
        id: resource.building.id,
        code: resource.building.code,
        name: resource.building.name,
      },
    };
  }
}
