import type { BookingStatus, StudentBooking } from "./types";

export type StudentBookingDisplayStatus = BookingStatus;

export const studentStatusLabels: Record<StudentBookingDisplayStatus, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export function studentStatusLabel(booking: Pick<StudentBooking, "status">): string {
  return studentStatusLabels[booking.status];
}
