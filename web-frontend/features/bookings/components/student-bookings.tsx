"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  RoomIcon,
  ShieldCheckIcon,
  StatusIcon,
} from "@/components/icons";
import { BookingRequestError, cancelStudentBooking } from "../api/browser";
import { studentStatusLabel } from "../status";
import type { StudentBooking, StudentBookingTimeline } from "../types";
import styles from "./student-bookings.module.css";

function dateParts(date: string): { day: string; month: string; full: string } {
  const value = new Date(`${date}T00:00:00+07:00`);
  return {
    day: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(value),
    month: new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(value),
    full: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(value),
  };
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function describeBooking(booking: StudentBooking): {
  heading: string;
  description: string;
} {
  if (booking.status === "cancelled") {
    return {
      heading: "This booking was cancelled",
      description: `Cancelled ${
        booking.cancelledAt ? formatDateTime(booking.cancelledAt) : ""
      }. The reserved time is available for others again.`,
    };
  }
  // confirmed
  if (booking.hasEnded) {
    return {
      heading: "Booking time ended",
      description: "The reserved time has ended. This booking is now in your history.",
    };
  }
  return {
    heading: "Booking confirmed",
    description:
      "This room is reserved for you. Cancel it here if your plans change.",
  };
}

function BookingRow({ booking }: { booking: StudentBooking }) {
  const date = dateParts(booking.date);
  return (
    <article className={styles.bookingRow} data-status={booking.status}>
      <time className={styles.dateBlock} dateTime={booking.date}>
        <strong>{date.day}</strong>
        <span>{date.month}</span>
      </time>
      <span className={styles.resourceIcon} data-type={booking.resource.type}>
        <RoomIcon />
      </span>
      <div className={styles.bookingIdentity}>
        <span className={styles.status} data-status={booking.status}>
          {studentStatusLabel(booking)}
        </span>
        <h3>{booking.resource.name}</h3>
        <p>
          <ClockIcon /> {booking.startTime}–{booking.endTime} ICT
          <span aria-hidden="true">·</span>
          <MapPinIcon /> {booking.resource.buildingCode} · {booking.resource.location}
        </p>
      </div>
      <Link className={styles.detailLink} href={`/bookings/${booking.id}`}>
        View details <ArrowRightIcon />
      </Link>
    </article>
  );
}

interface StudentBookingsProps {
  timeline: StudentBookingTimeline;
}

export function StudentBookings({ timeline }: StudentBookingsProps) {
  const cancelled = timeline.history.filter(
    (booking) => booking.status === "cancelled",
  );
  const next = timeline.upcoming[0];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.headerNav} aria-label="Booking navigation">
          <Link href="/">Rooms</Link>
          <Link href="/bookings" aria-current="page">My bookings</Link>
        </nav>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="bookings-title">
          <div>
            <p>Student booking ledger</p>
            <h1 id="bookings-title">Your campus reservations.</h1>
            <span>Prepare for confirmed visits and review past activity.</span>
          </div>
          <Link href="/resources">Find another room <ArrowRightIcon /></Link>
        </section>

        <section className={styles.nextPanel} aria-labelledby="next-booking-title">
          <div className={styles.nextCopy}>
            <p><CalendarIcon /> Next booking</p>
            {next ? (
              <>
                <span className={styles.nextStatus} data-status={next.status}>
                  {studentStatusLabel(next)}
                </span>
                <h2 id="next-booking-title">{next.resource.name}</h2>
                <strong>{dateParts(next.date).full}</strong>
                <span>{next.startTime}–{next.endTime} ICT · {next.resource.buildingName}</span>
                <Link href={`/bookings/${next.id}`}>Open booking <ArrowRightIcon /></Link>
              </>
            ) : (
              <>
                <h2 id="next-booking-title">No upcoming bookings</h2>
                <span>Your next confirmed reservation will appear here.</span>
                <Link href="/resources">Explore availability <ArrowRightIcon /></Link>
              </>
            )}
          </div>
          <div className={styles.nextMarker} aria-hidden="true">
            <span>{next ? dateParts(next.date).day : "—"}</span>
            <small>{next ? dateParts(next.date).month : "Open"}</small>
          </div>
        </section>

        <section className={styles.summary} aria-label="Booking summary">
          <div><ShieldCheckIcon /><strong>{timeline.upcoming.length}</strong><span>Confirmed upcoming</span></div>
          <div><ClockIcon /><strong>{cancelled.length}</strong><span>Cancelled bookings</span></div>
          <div><StatusIcon /><strong>{timeline.history.length}</strong><span>History entries</span></div>
        </section>

        <div className={styles.ledger}>
          <section aria-labelledby="upcoming-title">
            <div className={styles.sectionHeading}>
              <div><p>Active reservations</p><h2 id="upcoming-title">Upcoming bookings</h2></div>
              <span>{timeline.upcoming.length}</span>
            </div>
            {timeline.upcoming.length ? (
              <div className={styles.bookingList}>
                {timeline.upcoming.map((booking) => <BookingRow booking={booking} key={booking.id} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <CalendarIcon />
                <div><h3>No active reservations</h3><p>Search the directory by date and time to reserve a campus room.</p></div>
                <Link href="/resources">Browse rooms</Link>
              </div>
            )}
          </section>

          <section aria-labelledby="history-title">
            <div className={styles.sectionHeading}>
              <div><p>Booking record</p><h2 id="history-title">History</h2></div>
              <span>{timeline.history.length}</span>
            </div>
            {timeline.history.length ? (
              <div className={styles.bookingList}>
                {timeline.history.map((booking) => <BookingRow booking={booking} key={booking.id} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <StatusIcon />
                <div><h3>No booking history yet</h3><p>Past and cancelled bookings will remain here for reference.</p></div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

interface StudentBookingDetailProps {
  booking: StudentBooking;
}

export function StudentBookingDetail({ booking: initialBooking }: StudentBookingDetailProps) {
  const router = useRouter();
  const [booking, setBooking] = useState(initialBooking);
  const [confirming, setConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<BookingRequestError["code"] | null>(
    null,
  );
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const keepBookingRef = useRef<HTMLButtonElement>(null);
  const actionHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const date = dateParts(booking.date);
  const action = describeBooking(booking);

  useEffect(() => {
    if (confirming) keepBookingRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function keepBooking() {
    setConfirming(false);
    requestAnimationFrame(() => cancelButtonRef.current?.focus());
  }

  async function cancel() {
    if (isCancelling) return;
    setIsCancelling(true);
    setError("");
    setErrorCode(null);
    try {
      setBooking(await cancelStudentBooking(booking.id));
      setConfirming(false);
      setAnnouncement("Booking cancelled. The reserved time is released.");
      requestAnimationFrame(() => actionHeadingRef.current?.focus());
    } catch (caught) {
      setError(
        caught instanceof BookingRequestError
          ? caught.message
          : "This booking could not be cancelled. Try again.",
      );
      setErrorCode(
        caught instanceof BookingRequestError ? caught.code : "unexpected",
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <BrandMark />
        <nav className={styles.headerNav} aria-label="Booking navigation">
          <Link href="/">Rooms</Link>
          <Link href="/bookings" aria-current="page">My bookings</Link>
        </nav>
      </header>

      <div className={styles.detailShell}>
        <Link className={styles.backLink} href="/bookings">← Back to my bookings</Link>
        <section className={styles.detailHero} aria-labelledby="booking-title">
          <div>
            <span className={styles.status} data-status={booking.status}>{studentStatusLabel(booking)}</span>
            <p>{booking.resource.code} · Booking reference {booking.id.slice(0, 8).toUpperCase()}</p>
            <h1 id="booking-title">{booking.resource.name}</h1>
            <span>{booking.resource.buildingName} · {booking.resource.location}</span>
          </div>
          <time dateTime={booking.date}><strong>{date.day}</strong><span>{date.month}</span></time>
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.detailPanel} aria-labelledby="schedule-title">
            <div className={styles.detailHeading}><ClockIcon /><div><p>Booking schedule</p><h2 id="schedule-title">{date.full}</h2></div></div>
            <dl className={styles.detailFacts}>
              <div><dt>Time</dt><dd>{booking.startTime}–{booking.endTime} ICT (UTC+7)</dd></div>
              <div><dt>Status</dt><dd>{studentStatusLabel(booking)}</dd></div>
              <div><dt>Resource type</dt><dd>{booking.resource.type}</dd></div>
              <div><dt>Building</dt><dd>{booking.resource.buildingCode} · {booking.resource.buildingName}</dd></div>
              <div><dt>Location</dt><dd>{booking.resource.location}</dd></div>
              <div><dt>Requested</dt><dd>{formatDateTime(booking.createdAt)}</dd></div>
            </dl>
          </section>

          <aside className={styles.actionPanel} aria-labelledby="action-title">
            <ShieldCheckIcon />
            <h2 ref={actionHeadingRef} tabIndex={-1} id="action-title">
              {action.heading}
            </h2>
            <p>{action.description}</p>

            <p className={styles.actionStatus} role="status" aria-live="polite">
              {announcement}
            </p>

            {booking.canCancel && !confirming && (
              <button ref={cancelButtonRef} className={styles.cancelButton} type="button" onClick={() => setConfirming(true)}>Cancel booking</button>
            )}
            {booking.canCancel && confirming && (
              <div className={styles.confirmCancel} role="group" aria-label="Confirm booking cancellation">
                <strong>Release this time slot?</strong>
                <span>This cannot be undone.</span>
                <div>
                  <button ref={keepBookingRef} type="button" disabled={isCancelling} onClick={keepBooking}>Keep booking</button>
                  <button type="button" disabled={isCancelling} onClick={() => void cancel()}>{isCancelling ? "Cancelling…" : "Yes, cancel"}</button>
                </div>
              </div>
            )}
            {error && (
              <div className={styles.actionRecovery}>
                <p
                  ref={errorRef}
                  className={styles.actionError}
                  role="alert"
                  tabIndex={-1}
                >
                  {error}
                </p>
                {errorCode === "conflict" || errorCode === "not-found" ? (
                  <button type="button" onClick={() => router.refresh()}>
                    Refresh booking details
                  </button>
                ) : null}
              </div>
            )}
            <Link href={`/resources/${booking.resource.id}`}>View resource details <ArrowRightIcon /></Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
