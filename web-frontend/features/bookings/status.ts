import type { BookingStatus, StudentBooking } from "./types";

export type StudentBookingDisplayStatus = BookingStatus | "review_closed";

export const studentStatusLabels: Record<StudentBookingDisplayStatus, string> = {
  pending: "Pending approval",
  expired: "Expired request",
  review_closed: "Review window ended",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "Absent",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** A request has ended only when its stored status is actually expired. */
export function isExpiredRequest(booking: Pick<StudentBooking, "status">): boolean {
  return booking.status === "expired";
}

/** The deadline can pass before the release job persists an expired status. */
export function isReviewWindowClosed(
  booking: Pick<StudentBooking, "status" | "hasEnded" | "checkInDeadline">,
  now = Date.now(),
): boolean {
  return booking.status === "pending" &&
    (booking.hasEnded || now >= new Date(booking.checkInDeadline).getTime());
}

export function studentDisplayStatus(
  booking: Pick<StudentBooking, "status" | "hasEnded" | "checkInDeadline">,
): StudentBookingDisplayStatus {
  return isReviewWindowClosed(booking) ? "review_closed" : booking.status;
}

export function studentStatusLabel(
  booking: Pick<StudentBooking, "status" | "hasEnded" | "checkInDeadline">,
): string {
  return studentStatusLabels[studentDisplayStatus(booking)];
}

/** A campus-time clock reading such as "10:00", for reservation end times. */
export function campusClockTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
