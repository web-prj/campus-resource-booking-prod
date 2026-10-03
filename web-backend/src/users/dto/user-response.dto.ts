import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity';

/** The shape of a user sent back to the frontend (no password!). */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'an.nguyen@usth.edu.vn' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van An' })
  fullName: string;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    };
  }
}
