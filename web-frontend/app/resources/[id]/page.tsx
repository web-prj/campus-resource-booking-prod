import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getResourceAvailability,
  getResourceDetail,
} from "@/features/resources/api/server";
import { ResourceDetail } from "@/features/resources/components/resource-detail";
import { resolveSlotSelection } from "@/features/resources/slot-selection";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_PATTERN = /^(?:[01]\d|2[0-3]):00$/;

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Room details",
  description:
    "Review a USTH campus room, its operating schedule, available time slots, location, capacity, and amenities.",
};

interface ResourceDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResourceDetailPage({
  params,
  searchParams,
}: ResourceDetailPageProps) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const query = await searchParams;
  const dateValue = typeof query.date === "string" ? query.date : undefined;
  const checkedDate = isCalendarDate(dateValue) ? dateValue : undefined;
  const selectedStart =
    typeof query.startTime === "string" && SLOT_PATTERN.test(query.startTime)
      ? query.startTime
      : undefined;
  const selectedEnd =
    typeof query.endTime === "string" && SLOT_PATTERN.test(query.endTime)
      ? query.endTime
      : undefined;

  const resource = await getResourceDetail(id);
  if (!resource) notFound();
  const availability = checkedDate
    ? await getResourceAvailability(id, checkedDate)
    : null;
  if (checkedDate && !availability) notFound();

  const selection = availability
    ? resolveSlotSelection(availability, selectedStart, selectedEnd)
    : { selectedSlot: undefined, isSlotAvailable: false };

  return (
    <ResourceDetail
      resource={resource}
      availability={availability}
      checkedDate={checkedDate}
      selectedSlot={selection.selectedSlot}
      isSlotAvailable={selection.isSlotAvailable}
    />
  );
}
