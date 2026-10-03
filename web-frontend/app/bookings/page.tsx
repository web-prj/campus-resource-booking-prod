import type { Metadata } from "next";
import { getStudentBookings } from "@/features/bookings/api/server";
import { StudentBookings } from "@/features/bookings/components/student-bookings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My bookings",
  description: "Review upcoming and previous campus room bookings.",
};

export default async function BookingsPage() {
  const timeline = await getStudentBookings();
  return <StudentBookings timeline={timeline} />;
}
