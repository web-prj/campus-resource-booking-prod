import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { BookingResponseDto } from './dto/booking-response.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UserIdDto } from './dto/user-id.dto';

// Every request says which user it is for with a userId (no login tokens),
// and a user only ever sees or changes their own bookings.
@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List my bookings (GET /bookings?userId=...)' })
  @ApiOkResponse({ type: BookingResponseDto, isArray: true })
  async findAll(@Query() { userId }: UserIdDto): Promise<BookingResponseDto[]> {
    const bookings = await this.bookingsService.findAll(userId);
    return bookings.map(BookingResponseDto.fromEntity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my bookings' })
  @ApiOkResponse({ type: BookingResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() { userId }: UserIdDto,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingsService.findOne(userId, id);
    if (!booking) throw new NotFoundException('Booking not found');
    return BookingResponseDto.fromEntity(booking);
  }

  @Post()
  @ApiOperation({ summary: 'Book a room' })
  @ApiCreatedResponse({ type: BookingResponseDto })
  @ApiConflictResponse({ description: 'The room is already booked then' })
  async create(@Body() dto: CreateBookingDto): Promise<BookingResponseDto> {
    const booking = await this.bookingsService.create(dto.userId, dto);
    return BookingResponseDto.fromEntity(booking);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel one of my bookings' })
  @ApiOkResponse({ type: BookingResponseDto })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { userId }: UserIdDto,
  ): Promise<BookingResponseDto> {
    const booking = await this.bookingsService.cancel(userId, id);
    return BookingResponseDto.fromEntity(booking);
  }
}
