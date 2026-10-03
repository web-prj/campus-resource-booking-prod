import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DEFAULT_STUDENT_ID } from '../users/users.constants';
import { BookingsService } from './bookings.service';
import { BookingResponseDto } from './dto/booking-response.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  StudentBookingListResponseDto,
  StudentBookingResponseDto,
} from './dto/student-booking-response.dto';
import { Booking } from './entities/booking.entity';
import { BookingDomainError } from './errors/booking-domain.error';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  private readonly requesterId = DEFAULT_STUDENT_ID;

  constructor(private readonly bookingsService: BookingsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'List the student booking timeline' })
  @ApiOkResponse({ type: StudentBookingListResponseDto })
  async findMine(): Promise<StudentBookingListResponseDto> {
    const { upcoming, history, evaluatedAt } =
      await this.bookingsService.findForStudent(this.requesterId);
    return {
      upcoming: upcoming.map((booking) =>
        this.studentResponse(booking, evaluatedAt),
      ),
      history: history.map((booking) =>
        this.studentResponse(booking, evaluatedAt),
      ),
    };
  }

  @Get('mine/:id')
  @ApiOperation({ summary: 'View one booking owned by the student' })
  @ApiOkResponse({ type: StudentBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  async findMineById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentBookingResponseDto> {
    const booking = await this.bookingsService.findOneForStudent(
      this.requesterId,
      id,
    );
    if (!booking) throw new NotFoundException('Booking not found');
    return this.studentResponse(booking);
  }

  @Patch('mine/:id/cancel')
  @ApiOperation({ summary: 'Cancel an eligible student booking' })
  @ApiOkResponse({ type: StudentBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiConflictResponse({ description: 'Booking can no longer be cancelled' })
  async cancelMine(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentBookingResponseDto> {
    try {
      return this.studentResponse(
        await this.bookingsService.cancel(this.requesterId, id),
      );
    } catch (error: unknown) {
      if (error instanceof BookingDomainError) {
        if (error.code === 'BOOKING_NOT_FOUND') {
          throw new NotFoundException({
            code: error.code,
            message: error.message,
          });
        }
        if (error.code === 'BOOKING_NOT_CANCELLABLE') {
          throw new ConflictException({
            code: error.code,
            message: error.message,
          });
        }
      }
      throw error;
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({ type: BookingResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or past booking interval' })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  @ApiConflictResponse({ description: 'Resource unavailable or overlapping' })
  async create(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    try {
      return BookingResponseDto.fromEntity(
        await this.bookingsService.create(this.requesterId, dto),
      );
    } catch (error: unknown) {
      if (error instanceof BookingDomainError) {
        const body = { code: error.code, message: error.message };
        if (
          error.code === 'INVALID_BOOKING_DATE' ||
          error.code === 'INVALID_BOOKING_RANGE' ||
          error.code === 'BOOKING_TOO_LONG' ||
          error.code === 'BOOKING_IN_PAST'
        ) {
          throw new BadRequestException(body);
        }
        if (error.code === 'RESOURCE_NOT_FOUND') {
          throw new NotFoundException(body);
        }
        if (
          error.code === 'RESOURCE_UNAVAILABLE' ||
          error.code === 'BOOKING_OVERLAP'
        ) {
          throw new ConflictException(body);
        }
      }
      throw error;
    }
  }

  private studentResponse(
    booking: Booking,
    evaluatedAt: Date = this.bookingsService.currentTime(),
  ): StudentBookingResponseDto {
    return StudentBookingResponseDto.fromEntity(
      booking,
      this.bookingsService.canCancel(booking, evaluatedAt),
      this.bookingsService.hasEnded(booking, evaluatedAt),
    );
  }
}
