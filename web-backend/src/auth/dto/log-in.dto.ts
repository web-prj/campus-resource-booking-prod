import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class LogInDto {
  @ApiProperty({ example: 'an.nguyen@usth.edu.vn' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[^\s@]+@usth\.edu\.vn$/, {
    message: 'Please use your @usth.edu.vn email address.',
  })
  email: string;

  @ApiProperty({ example: 'my-secret-pass' })
  @IsString()
  @Length(1, 72)
  password: string;
}
