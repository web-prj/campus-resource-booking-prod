"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createBooking } from "@/lib/api";
import { useCurrentUser } from "@/lib/current-user";

// The whole hours a student can pick as a start or end time.
const HOURS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

// Today's date on campus as "YYYY-MM-DD", so past days cannot be picked.
function todayOnCampus(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export default function BookingForm({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const user = useCurrentUser();

  // The success pop-up is a native <dialog> we open after a booking is made.
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Keep track of what the student typed.
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!user) {
      setError("Please log in to book.");
      return;
    }

    // Simple check: the start time must be before the end time.
    if (startTime >= endTime) {
      setError("The start time must be before the end time.");
      return;
    }

    setSubmitting(true);
    try {
      // Send the logged-in user's id along with the booking.
      await createBooking({
        userId: user.id,
        resourceId,
        date,
        startTime,
        endTime,
      });
      // Show the "Booking confirmed" pop-up.
      dialogRef.current?.showModal();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sorry, the booking could not be made. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Go to the bookings list (it loads fresh data when it opens).
  function viewBookings() {
    dialogRef.current?.close();
    router.push("/bookings");
  }

  // Only logged-in students can book.
  if (user === null) {
    return (
      <div className="login-prompt">
        <p>Log in to book this space.</p>
        <Link href="/login" className="button-primary">
          Log in
        </Link>
        <p className="form-switch">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    );
  }

  return (
    <>
    <form className="form" onSubmit={handleSubmit}>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="form-field">
        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          required
          min={todayOnCampus()}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="time-row">
        <div className="form-field">
          <label htmlFor="startTime">Start time</label>
          <select
            id="startTime"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="endTime">End time</label>
          <select
            id="endTime"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          >
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Booking..." : "Book now"}
      </button>
    </form>

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="confirm-title">
        <h2 id="confirm-title">Booking confirmed</h2>
        <p>
          Your space is booked for {date || "the selected date"}, {startTime}
          &ndash;{endTime}.
        </p>
        <div className="confirm-actions">
          <button type="button" className="button-primary" onClick={viewBookings}>
            View my bookings
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={() => dialogRef.current?.close()}
          >
            Book another time
          </button>
        </div>
      </dialog>
    </>
  );
}
