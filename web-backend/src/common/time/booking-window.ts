/**
 * Campus-wide student booking window. Students may only reserve resources
 * between these whole-hour bounds, regardless of a resource's own wider
 * operating hours. Times are campus-local (ICT, UTC+7) "HH:00" strings, which
 * compare correctly with plain lexicographic comparison.
 */
export const BOOKING_WINDOW_START = '08:00';
export const BOOKING_WINDOW_END = '18:00';

/**
 * Longest single reservation a student may make, in whole hours. A booking's
 * span (endTime − startTime) must not exceed this.
 */
export const BOOKING_MAX_DURATION_HOURS = 3;

/**
 * Intersects a resource's operating hours with the campus booking window.
 * The result is the effective bookable span; when the resource never overlaps
 * the window, `open` is at or after `close` and no slots are bookable.
 */
export function clampToBookingWindow(
  opensAt: string,
  closesAt: string,
): { open: string; close: string } {
  const open = opensAt > BOOKING_WINDOW_START ? opensAt : BOOKING_WINDOW_START;
  const close = closesAt < BOOKING_WINDOW_END ? closesAt : BOOKING_WINDOW_END;
  return { open, close };
}
