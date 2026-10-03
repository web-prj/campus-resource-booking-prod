import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'Nguyen Van An' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120, { message: 'Please enter your name.' })
  fullName: string;

  @ApiProperty({ example: 'an.nguyen@usth.edu.vn' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[^\s@]+@usth\.edu\.vn$/, {
    message: 'Please use your @usth.edu.vn email address.',
  })
  email: string;

  @ApiProperty({ example: 'my-secret-pass', minLength: 8 })
  @IsString()
  @Length(8, 72, { message: 'Password must be at least 8 characters.' })
  password: string;
}
