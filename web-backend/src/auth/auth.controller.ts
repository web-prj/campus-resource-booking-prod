import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthService } from './auth.service';
import { LogInDto } from './dto/log-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Create a new student account' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'Email already has an account' })
  async signUp(@Body() dto: SignUpDto): Promise<UserResponseDto> {
    const user = await this.authService.signUp(dto);
    return UserResponseDto.fromEntity(user);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async logIn(@Body() dto: LogInDto): Promise<UserResponseDto> {
    const user = await this.authService.logIn(dto);
    return UserResponseDto.fromEntity(user);
  }
}
