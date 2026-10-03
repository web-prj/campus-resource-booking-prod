import { ApiProperty } from '@nestjs/swagger';
import { Booking } from '../entities/booking.entity';
import { BookingStatus } from '../enums/booking-status.enum';

class BookingRoomBuildingDto {
  @ApiProperty({ example: 'Alpha Building' })
  name: string;
}

class BookingRoomDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ALP-101' })
  code: string;

  @ApiProperty({ example: 'Room 101' })
  name: string;

  @ApiProperty({ example: 'First floor' })
  location: string;

  @ApiProperty({ type: BookingRoomBuildingDto })
  building: BookingRoomBuildingDto;
}

/** The shape of a booking sent back to the frontend. */
export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-09-16' })
  date: string;

  @ApiProperty({ example: '09:00' })
  startTime: string;

  @ApiProperty({ example: '10:00' })
  endTime: string;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty({ nullable: true })
  cancelledAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: BookingRoomDto })
  resource: BookingRoomDto;

  static fromEntity(booking: Booking): BookingResponseDto {
    return {
      id: booking.id,
      date: booking.date,
      // Postgres returns time as "HH:MM:SS"; trim to "HH:MM" for the UI.
      startTime: booking.startTime.slice(0, 5),
      endTime: booking.endTime.slice(0, 5),
      status: booking.status,
      cancelledAt: booking.cancelledAt,
      createdAt: booking.createdAt,
      resource: {
        id: booking.resource.id,
        code: booking.resource.code,
        name: booking.resource.name,
        location: booking.resource.location,
        building: { name: booking.resource.building.name },
      },
    };
  }
}
