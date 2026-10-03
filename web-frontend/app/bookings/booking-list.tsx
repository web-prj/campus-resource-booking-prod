"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBookings } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";
import type { Booking } from "@/lib/types";
import CancelButton from "./cancel-button";

// Turn "2026-10-05" into a friendly date like "Mon, 5 Oct".
// We add "T00:00:00" so the date is read in local time, not UTC.
function formatDate(date: string): { weekday: string; rest: string } {
  const value = new Date(`${date}T00:00:00`);
  return {
    weekday: value.toLocaleDateString("en-GB", { weekday: "short" }),
    rest: value.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  };
}

// Shows a log in message, or the bookings of the logged-in user.
export default function BookingList() {
  const user = useCurrentUser();

  if (user === undefined) {
    return <p className="empty">Loading...</p>;
  }

  if (user === null) {
    return (
      <div className="empty-state">
        <p>Log in to see your bookings.</p>
        <Link href="/login" className="button-primary">
          Log in
        </Link>
      </div>
    );
  }

  // `key` makes React start fresh if a different user logs in.
  return <UserBookings key={user.id} userId={user.id} />;
}

function UserBookings({ userId }: { userId: string }) {
  // null means "still loading".
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");

  // Load this user's bookings when the page opens.
  useEffect(() => {
    let ignore = false;
    getBookings(userId)
      .then((list) => {
        if (!ignore) setBookings(list);
      })
      .catch(() => {
        if (!ignore) setError("Sorry, your bookings could not be loaded.");
      });
    // If the page closes before the request finishes, ignore the answer.
    return () => {
      ignore = true;
    };
  }, [userId]);

  // Swap in the cancelled booking returned by the backend.
  function handleCancelled(updated: Booking) {
    setBookings((list) =>
      list ? list.map((b) => (b.id === updated.id ? updated : b)) : list,
    );
  }

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }

  if (bookings === null) {
    return (
      <p className="empty" role="status">
        Loading your bookings...
      </p>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="empty-state">
        <p>You have no bookings yet.</p>
        <Link href="/" className="button-primary">
          Browse spaces
        </Link>
      </div>
    );
  }

  return (
    <ul className="booking-list">
      {bookings.map((booking) => {
        const day = formatDate(booking.date);
        return (
          <li key={booking.id} className={`ticket ticket-${booking.status}`}>
            <div className="ticket-date" aria-hidden="true">
              <span className="ticket-weekday">{day.weekday}</span>
              <span className="ticket-day">{day.rest}</span>
            </div>

            <div className="ticket-body">
              <h2 className="ticket-room">{booking.resource.name}</h2>
              <p className="ticket-where">
                {booking.resource.building.name} &middot;{" "}
                {booking.resource.location}
              </p>
              <p className="ticket-time">
                {booking.date}, {booking.startTime}&ndash;{booking.endTime}
              </p>
            </div>

            <div className="ticket-side">
              <span className={`status status-${booking.status}`}>
                {booking.status}
              </span>
              {booking.status === "confirmed" && (
                <CancelButton
                  id={booking.id}
                  userId={userId}
                  onCancelled={handleCancelled}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
