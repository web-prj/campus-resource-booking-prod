import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Says which student is making the request. The frontend sends the id it got
 * back from log in: as ?userId=... for GET requests, or in the JSON body.
 */
export class UserIdDto {
  @ApiProperty({ format: 'uuid', description: 'The logged-in user id' })
  @IsUUID('all', { message: 'Please log in first.' })
  userId: string;
}
