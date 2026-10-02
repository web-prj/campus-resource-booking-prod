import { registerAs } from '@nestjs/config';

export const BOOKINGS_CONFIG_KEY = 'bookings';

/** Booking lifecycle settings. */
export const bookingsConfig = registerAs(BOOKINGS_CONFIG_KEY, () => ({
  /**
   * How often, in seconds, confirmed bookings that missed their check-in
   * deadline are released. 0 disables the background job (used by the e2e
   * suite, which drives releases directly under a frozen clock).
   */
  releaseIntervalSeconds: Number(
    process.env.BOOKING_RELEASE_INTERVAL_SECONDS ?? 60,
  ),
}));
