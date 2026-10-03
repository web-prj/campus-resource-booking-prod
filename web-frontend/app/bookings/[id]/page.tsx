import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudentBooking } from "@/features/bookings/api/server";
import { StudentBookingDetail } from "@/features/bookings/components/student-bookings";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking details",
  description: "Review a campus booking and cancel it when eligible.",
};

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const booking = await getStudentBooking(id);
  if (!booking) notFound();
  return (
    <StudentBookingDetail
      key={`${booking.id}:${booking.status}:${booking.canCancel}:${booking.hasEnded}`}
      booking={booking}
    />
  );
}
