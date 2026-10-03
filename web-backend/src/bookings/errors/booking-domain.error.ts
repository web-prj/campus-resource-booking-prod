export type BookingErrorCode =
  | 'INVALID_BOOKING_DATE'
  | 'INVALID_BOOKING_RANGE'
  | 'BOOKING_TOO_LONG'
  | 'BOOKING_IN_PAST'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_UNAVAILABLE'
  | 'BOOKING_OVERLAP'
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_NOT_CANCELLABLE';

export class BookingDomainError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BookingDomainError';
  }
}
