import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID, Matches } from 'class-validator';
import { UserIdDto } from './user-id.dto';

// A real time of day from 00:00 to 23:59 (so "25:00" is rejected).
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Includes userId (from UserIdDto) so we know who is booking.
export class CreateBookingDto extends UserIdDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  resourceId: string;

  @ApiProperty({ example: '2026-09-16', description: 'Date as YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  // `strict` also rejects days that do not exist, like 2026-02-30.
  @IsISO8601({ strict: true }, { message: 'date must be a real date' })
  date: string;

  @ApiProperty({ example: '09:00', description: 'Start time as HH:MM' })
  @Matches(TIME_PATTERN, { message: 'startTime must be HH:MM' })
  startTime: string;

  @ApiProperty({ example: '10:00', description: 'End time as HH:MM' })
  @Matches(TIME_PATTERN, { message: 'endTime must be HH:MM' })
  endTime: string;
}
