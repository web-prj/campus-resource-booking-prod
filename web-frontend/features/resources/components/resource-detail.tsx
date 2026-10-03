import Link from "next/link";
import { BookingRequestForm } from "@/features/bookings/components/booking-request-form";
import { BrandMark } from "@/components/brand-mark";
import {
  ChevronLeftIcon,
  ClockIcon,
  MapPinIcon,
  PeopleIcon,
  RoomIcon,
  ShieldCheckIcon,
} from "@/components/icons";
import type {
  AvailabilityBlockedReason,
  AvailabilitySlot,
  Resource,
  ResourceAvailability,
  ResourceStatus,
  ResourceType,
} from "../types";
import { SlotRangePicker } from "./slot-range-picker";
import styles from "./resource-detail.module.css";

const typeLabels: Record<ResourceType, string> = {
  room: "Room",
};

const statusLabels: Record<ResourceStatus, string> = {
  active: "Active resource",
  maintenance: "Under maintenance",
  inactive: "Inactive resource",
};

const blockedMessages: Record<AvailabilityBlockedReason, string> = {
  maintenance: "This resource is under maintenance and has no available slots.",
  inactive: "This resource is inactive and has no available slots.",
  closure: "This resource is closed for the selected date.",
  closed_day: "This date is outside the resource’s operating days.",
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scheduleDays(days: number[]): string {
  return days.map((day) => dayLabels[day]).join(", ");
}

interface ResourceDetailProps {
  resource: Resource;
  availability?: ResourceAvailability | null;
  checkedDate?: string;
  selectedSlot?: AvailabilitySlot;
  isSlotAvailable?: boolean;
}

export function ResourceDetail({
  resource,
  availability = null,
  checkedDate,
  selectedSlot,
  isSlotAvailable = true,
}: ResourceDetailProps) {
  const scheduleDaysValue = availability?.operatingDays ?? resource.operatingDays;
  const scheduleOpensAt = availability?.opensAt ?? resource.opensAt;
  const scheduleClosesAt = availability?.closesAt ?? resource.closesAt;
  const requiresApproval =
    availability?.requiresApproval ?? resource.requiresApproval;
  const operationalStatus = availability?.status ?? resource.status;
  const statusDescription =
    operationalStatus === "active"
      ? "Listed in the student directory"
      : "Unavailable for operational use";
  const requestForm =
    availability && selectedSlot ? (
      <BookingRequestForm
        key={`${availability.date}:${selectedSlot.startTime}:${selectedSlot.endTime}`}
        resourceName={resource.name}
        isSlotAvailable={isSlotAvailable}
        chooseAnotherHref={`/resources/${resource.id}?date=${encodeURIComponent(
          availability.date,
        )}`}
        input={{
          resourceId: resource.id,
          date: availability.date,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        }}
      />
    ) : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.headerNav} aria-label="Resource navigation">
          <Link href="/" aria-current="page">
            Rooms
          </Link>
          <Link href="/bookings">My bookings</Link>
        </nav>
      </header>

      <div className={styles.shell}>
        <Link className={styles.backLink} href="/resources">
          <ChevronLeftIcon /> Back to resource directory
        </Link>

        <section className={styles.resourceHero} aria-labelledby="resource-title">
          <div className={styles.heroIdentity}>
            <span className={styles.resourceIcon} data-type={resource.type}>
              <RoomIcon />
            </span>
            <div>
              <p>
                {typeLabels[resource.type]} · {resource.code}
              </p>
              <h1 id="resource-title">{resource.name}</h1>
              <span>
                <MapPinIcon /> {resource.building.name} · {resource.location}
              </span>
            </div>
          </div>

          <div className={styles.heroStatus} data-status={operationalStatus}>
            <span>{statusLabels[operationalStatus]}</span>
            <p>{statusDescription}</p>
          </div>
        </section>

        <section
          className={styles.availabilityWorkspace}
          aria-labelledby="availability-title"
        >
          <div className={styles.availabilityHeading}>
            <span className={styles.availabilityIcon}>
              <ClockIcon />
            </span>
            <div>
              <p>Operational schedule</p>
              <h2 id="availability-title">Check availability</h2>
              <span>
                {scheduleDays(scheduleDaysValue)} · {scheduleOpensAt}–
                {scheduleClosesAt} ICT (UTC+7)
              </span>
            </div>
          </div>

          <form
            key={`${checkedDate ?? "no-date"}:${selectedSlot?.startTime ?? "no-start"}:${selectedSlot?.endTime ?? "no-end"}`}
            className={styles.dateForm}
            method="get"
          >
            <label>
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={checkedDate ?? ""}
              />
            </label>
            <button type="submit">Check date</button>
          </form>

          {!availability ? null : availability.blockedReason ? (
            <div className={styles.blockedState} role="status">
              <strong>No operational availability</strong>
              <span>{blockedMessages[availability.blockedReason]}</span>
              {availability.closureReason && (
                <small>Closure reason: {availability.closureReason}</small>
              )}
            </div>
          ) : availability.slots.length === 0 ? (
            <div className={styles.blockedState} role="status">
              <strong>No bookable hourly slots remain</strong>
              <span>
                Every operational slot on this date has elapsed or is occupied
                by a confirmed booking. Choose another date.
              </span>
            </div>
          ) : null}
          {availability && availability.slots.length === 0 && requestForm}
          {availability && !availability.blockedReason && availability.slots.length > 0 && (
            <div className={styles.slotArea}>
              <div className={styles.slotSummary} role="status">
                <strong>
                  {availability.slots.length} operational hourly {availability.slots.length === 1 ? "slot" : "slots"}
                </strong>
                <span>{availability.date} · ICT (UTC+7)</span>
                <small>
                  Confirmed bookings are excluded. Availability is
                  checked again when a booking request is sent.
                </small>
              </div>
              <SlotRangePicker
                resourceId={resource.id}
                date={availability.date}
                slots={availability.slots}
                initialStart={isSlotAvailable ? selectedSlot?.startTime : undefined}
                initialEnd={isSlotAvailable ? selectedSlot?.endTime : undefined}
              />
              {requestForm}
            </div>
          )}

          <div className={styles.availabilityPolicy}>
            <ShieldCheckIcon />
            <span>
              {availability
                ? requiresApproval
                  ? "When this date was checked, the resource required staff approval."
                  : "When this date was checked, the resource permitted immediate confirmation."
                : requiresApproval
                  ? "The resource currently requires staff approval."
                  : "The resource currently permits immediate confirmation."}{" "}
              The policy and availability are checked again when the request is sent.
            </span>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <section className={styles.detailPanel} aria-labelledby="overview-title">
              <div className={styles.sectionHeading}>
                <p>Resource overview</p>
                <h2 id="overview-title">What this resource offers</h2>
              </div>
              <p className={styles.description}>
                {resource.description ||
                  "No additional description has been provided for this resource."}
              </p>

              <dl className={styles.facts}>
                <div>
                  <dt>
                    <PeopleIcon /> Capacity
                  </dt>
                  <dd>
                    {resource.capacity} {resource.capacity === 1 ? "place" : "places"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <ShieldCheckIcon /> Approval policy
                  </dt>
                  <dd>
                    {requiresApproval
                      ? "Staff approval required"
                      : "No staff approval required"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <MapPinIcon /> Building
                  </dt>
                  <dd>{resource.building.name}</dd>
                </div>
                <div>
                  <dt>Campus location</dt>
                  <dd>{resource.location}</dd>
                </div>
              </dl>
            </section>

            <section className={styles.amenityPanel} aria-labelledby="amenities-title">
              <div className={styles.sectionHeading}>
                <p>Room setup and facilities</p>
                <h2 id="amenities-title">Amenities</h2>
              </div>
              {resource.amenities.length ? (
                <ul>
                  {resource.amenities.map((amenity) => (
                    <li key={amenity}>{amenity}</li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyAmenities}>
                  No additional amenities are listed. Check the room details with
                  campus staff if you need a specific setup.
                </p>
              )}
            </section>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.locationPanel} aria-labelledby="location-title">
              <span className={styles.locationIcon}>
                <MapPinIcon />
              </span>
              <div>
                <p>Campus location</p>
                <h2 id="location-title">{resource.building.code}</h2>
                <strong>{resource.building.name}</strong>
                <span>{resource.building.address}</span>
                <small>{resource.location}</small>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
