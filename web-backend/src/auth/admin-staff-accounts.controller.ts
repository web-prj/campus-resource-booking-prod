import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from './decorators/roles.decorator';
import { AdminUserResponseDto } from '../users/dto/admin-user-response.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { AuthService } from './auth.service';
import { CreateStaffAccountDto } from './dto/create-staff-account.dto';

/**
 * Lives in the auth module because it sets a password; the rest of user
 * administration is in AdminUsersController.
 */
@ApiTags('admin users')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Administrator role required' })
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminStaffAccountsController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @ApiOperation({ summary: 'Create a staff account' })
  @ApiCreatedResponse({ type: AdminUserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid account details' })
  @ApiConflictResponse({ description: 'Email already registered' })
  async create(
    @Body() dto: CreateStaffAccountDto,
  ): Promise<AdminUserResponseDto> {
    return AdminUserResponseDto.fromEntity(
      await this.authService.createStaffAccount(dto),
    );
  }
}
