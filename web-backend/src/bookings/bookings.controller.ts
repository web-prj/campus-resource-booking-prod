import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DEFAULT_STUDENT_ID } from '../users/users.constants';
import { BookingsService } from './bookings.service';
import { BookingResponseDto } from './dto/booking-response.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  // Auth was removed, so every booking belongs to the one seeded student.
  private readonly requesterId = DEFAULT_STUDENT_ID;

  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List my bookings' })
  @ApiOkResponse({ type: BookingResponseDto, isArray: true })
  async findAll(): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingsService.findAll(this.requesterId);
    return bookings.map(BookingResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my bookings' })
  @ApiOkResponse({ type: BookingResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingsService.findOne(this.requesterId, id);
    if (!booking) throw new NotFoundException('Booking not found');
    return BookingResponseDto.fromEntity(booking);
  }

  @Post()
  @ApiOperation({ summary: 'Book a room' })
  @ApiCreatedResponse({ type: BookingResponseDto })
  async create(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    const booking = await this.bookingsService.create(this.requesterId, dto);
    return BookingResponseDto.fromEntity(booking);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiOkResponse({ type: BookingResponseDto })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingsService.cancel(this.requesterId, id);
    return BookingResponseDto.fromEntity(booking);
  }
}
