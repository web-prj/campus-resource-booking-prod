"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBooking } from "@/lib/api";

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

export default function BookingForm({ resourceId }: { resourceId: string }) {
  const router = useRouter();

  // Keep track of what the student typed.
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // Simple check: the start time must be before the end time.
    if (startTime >= endTime) {
      setError("The start time must be before the end time.");
      return;
    }

    setSubmitting(true);
    try {
      await createBooking({ resourceId, date, startTime, endTime });
      // After booking, go to the list of bookings.
      router.push("/bookings");
    } catch {
      setError("Sorry, the booking could not be made. Please try again.");
      setSubmitting(false);
    }
  }

  return (
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
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

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

      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Booking..." : "Book now"}
      </button>
    </form>
  );
}
