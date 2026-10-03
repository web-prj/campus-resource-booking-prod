import type {
  BookingRequestInput,
  BookingRequestResult,
  BookingResourceSummary,
  BookingStatus,
  StudentBooking,
  StudentBookingTimeline,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_PATTERN = /^(?:[01]\d|2[0-3]):00$/;
const STATUSES: ReadonlySet<BookingStatus> = new Set([
  "confirmed",
  "cancelled",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseBookingResource(value: unknown): BookingResourceSummary | null {
  if (!isRecord(value)) return null;
  const { id, code, name, type, location, buildingCode, buildingName } = value;
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    typeof code !== "string" ||
    typeof name !== "string" ||
    type !== "room" ||
    typeof location !== "string" ||
    typeof buildingCode !== "string" ||
    typeof buildingName !== "string"
  ) {
    return null;
  }
  return { id, code, name, type, location, buildingCode, buildingName };
}

export function parseBookingRequestResult(
  value: unknown,
  input: BookingRequestInput,
): BookingRequestResult | null {
  if (!isRecord(value)) return null;
  const {
    id,
    resourceId,
    date,
    startTime,
    endTime,
    timeZone,
    status,
    createdAt,
  } = value;

  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    resourceId !== input.resourceId ||
    date !== input.date ||
    startTime !== input.startTime ||
    endTime !== input.endTime ||
    !isCalendarDate(date) ||
    typeof startTime !== "string" ||
    !HOUR_PATTERN.test(startTime) ||
    typeof endTime !== "string" ||
    !HOUR_PATTERN.test(endTime) ||
    startTime >= endTime ||
    timeZone !== "Asia/Ho_Chi_Minh" ||
    status !== "confirmed" ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    id,
    resourceId,
    date,
    startTime,
    endTime,
    timeZone,
    status: "confirmed",
    createdAt,
  };
}

export function parseStudentBooking(value: unknown): StudentBooking | null {
  if (!isRecord(value)) return null;
  const {
    id,
    date,
    startTime,
    endTime,
    timeZone,
    status,
    canCancel,
    hasEnded,
    cancelledAt,
    createdAt,
    resource,
  } = value;
  const parsedResource = parseBookingResource(resource);
  if (
    typeof id !== "string" ||
    !UUID_PATTERN.test(id) ||
    !isCalendarDate(date) ||
    typeof startTime !== "string" ||
    !HOUR_PATTERN.test(startTime) ||
    typeof endTime !== "string" ||
    !HOUR_PATTERN.test(endTime) ||
    startTime >= endTime ||
    timeZone !== "Asia/Ho_Chi_Minh" ||
    typeof status !== "string" ||
    !STATUSES.has(status as BookingStatus) ||
    typeof canCancel !== "boolean" ||
    typeof hasEnded !== "boolean" ||
    (cancelledAt !== null && !isValidTimestamp(cancelledAt)) ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt)) ||
    !parsedResource ||
    // An ended booking can no longer be cancelled.
    (hasEnded && canCancel) ||
    // Status-specific consistency: a cancelled booking carries its timestamp
    // and can no longer be cancelled; a confirmed booking has none.
    (status === "cancelled"
      ? canCancel || cancelledAt === null
      : cancelledAt !== null)
  ) {
    return null;
  }
  return {
    id,
    date,
    startTime,
    endTime,
    timeZone,
    status: status as BookingStatus,
    canCancel,
    hasEnded,
    cancelledAt,
    createdAt,
    resource: parsedResource,
  };
}

function bookingStart(booking: StudentBooking | null): string {
  return booking ? `${booking.date}T${booking.startTime}` : "";
}

function isChronological(
  bookings: Array<StudentBooking | null>,
  direction: "asc" | "desc",
): boolean {
  return bookings.every((booking, index) => {
    if (index === 0) return true;
    const previous = bookingStart(bookings[index - 1]);
    const current = bookingStart(booking);
    return direction === "asc" ? previous <= current : previous >= current;
  });
}

export function parseStudentBookingTimeline(
  value: unknown,
): StudentBookingTimeline | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.upcoming) ||
    !Array.isArray(value.history)
  ) {
    return null;
  }
  const upcoming = value.upcoming.map(parseStudentBooking);
  const history = value.history.map(parseStudentBooking);
  const bookings = [...upcoming, ...history];
  if (
    upcoming.some(
      (booking) =>
        booking === null ||
        booking.hasEnded ||
        booking.status !== "confirmed",
    ) ||
    history.some(
      (booking) =>
        booking === null ||
        (booking.status === "confirmed" && !booking.hasEnded),
    ) ||
    new Set(bookings.map((booking) => booking?.id)).size !== bookings.length ||
    !isChronological(upcoming, "asc") ||
    !isChronological(history, "desc")
  ) {
    return null;
  }
  return {
    upcoming: upcoming as StudentBooking[],
    history: history as StudentBooking[],
  };
}
