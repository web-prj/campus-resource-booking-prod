"use client";

import { useEffect, useRef, useState } from "react";
import type { ResourceDiscoveryFilters } from "../types";

interface AvailabilityFilterFieldsProps {
  filters: Pick<
    ResourceDiscoveryFilters,
    "date" | "startTime" | "endTime"
  >;
}

// Students may only book inside the campus window of 08:00–18:00 (ICT).
const startTimes = Array.from({ length: 10 }, (_, index) =>
  `${String(index + 8).padStart(2, "0")}:00`,
);
const endTimes = Array.from({ length: 10 }, (_, index) =>
  `${String(index + 9).padStart(2, "0")}:00`,
);

export function AvailabilityFilterFields({
  filters,
}: AvailabilityFilterFieldsProps) {
  const [date, setDate] = useState(filters.date ?? "");
  const [startTime, setStartTime] = useState(filters.startTime ?? "");
  const [endTime, setEndTime] = useState(filters.endTime ?? "");
  const endRef = useRef<HTMLSelectElement>(null);

  // "Until" must be after "From"; surface it inline rather than reordering.
  const invalidInterval = Boolean(
    startTime && endTime && endTime <= startTime,
  );

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.setCustomValidity(
      invalidInterval ? "Until must be after From." : "",
    );
  }, [invalidInterval, endTime, startTime]);

  return (
    <>
      <label>
        <span>Operational date</span>
        <input
          name="date"
          type="date"
          value={date}
          required={Boolean(startTime || endTime)}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>

      <label>
        <span>From</span>
        <select
          name={startTime ? "startTime" : undefined}
          value={startTime}
          required={Boolean(endTime)}
          onChange={(event) => setStartTime(event.target.value)}
        >
          <option value="">Any start</option>
          {startTimes.map((time) => (
            <option value={time} key={time}>
              {time}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Until</span>
        <select
          ref={endRef}
          name={endTime ? "endTime" : undefined}
          value={endTime}
          required={Boolean(startTime)}
          aria-invalid={invalidInterval ? "true" : undefined}
          onChange={(event) => setEndTime(event.target.value)}
        >
          <option value="">Any end</option>
          {endTimes.map((time) => (
            <option value={time} key={time}>
              {time}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
