import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches } from 'class-validator';
import { UserIdDto } from './user-id.dto';

// Includes userId (from UserIdDto) so we know who is booking.
export class CreateBookingDto extends UserIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2026-09-16', description: 'Date as YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '09:00', description: 'Start time as HH:MM' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:MM' })
  startTime: string;

  @ApiProperty({ example: '10:00', description: 'End time as HH:MM' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:MM' })
  endTime: string;
}
