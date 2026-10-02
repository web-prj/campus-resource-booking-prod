"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AvailabilitySlot } from "../types";
import { MAX_BOOKING_HOURS } from "../slot-selection";
import styles from "./resource-detail.module.css";

interface SlotRangePickerProps {
  resourceId: string;
  date: string;
  /** Available, occupied-free hourly slots for the date, ascending. */
  slots: AvailabilitySlot[];
  initialStart?: string;
  initialEnd?: string;
}

function hourOf(time: string): number {
  return Number(time.slice(0, 2));
}

function hoursBetween(start: string, end: string): number {
  return hourOf(end) - hourOf(start);
}

export function SlotRangePicker({
  resourceId,
  date,
  slots,
  initialStart,
  initialEnd,
}: SlotRangePickerProps) {
  const slotEndByStart = useMemo(() => {
    const map = new Map<string, string>();
    for (const slot of slots) map.set(slot.startTime, slot.endTime);
    return map;
  }, [slots]);

  const isAnchorable = (start: string) => slotEndByStart.has(start);

  // `anchor` is the chosen start hour; `rangeEnd` is set only once a later end
  // hour completes a multi-hour selection.
  const [anchor, setAnchor] = useState<string | null>(
    initialStart && isAnchorable(initialStart) ? initialStart : null,
  );
  const [rangeEnd, setRangeEnd] = useState<string | null>(
    initialStart &&
      isAnchorable(initialStart) &&
      initialEnd &&
      hoursBetween(initialStart, initialEnd) > 1 &&
      hoursBetween(initialStart, initialEnd) <= MAX_BOOKING_HOURS
      ? initialEnd
      : null,
  );

  /** Every hour from start (inclusive) to end (exclusive) is a bookable slot. */
  function isContiguous(start: string, end: string): boolean {
    for (let hour = hourOf(start); hour < hourOf(end); hour += 1) {
      if (!slotEndByStart.has(`${String(hour).padStart(2, "0")}:00`)) {
        return false;
      }
    }
    return true;
  }

  function handleSelect(slot: AvailabilitySlot) {
    if (anchor === null) {
      // First click: this slot becomes the single-hour anchor.
      setAnchor(slot.startTime);
      setRangeEnd(null);
      return;
    }
    if (slot.startTime < anchor) {
      // Clicking earlier moves the anchor back.
      setAnchor(slot.startTime);
      setRangeEnd(null);
      return;
    }
    if (slot.startTime === anchor) {
      // Clicking the anchor again collapses back to a single hour.
      setRangeEnd(null);
      return;
    }
    // Clicking a later slot extends the range — including growing an existing
    // range block by block — while the span is unbroken and within the maximum.
    // Anything longer or broken starts a fresh selection at the clicked slot.
    if (
      isContiguous(anchor, slot.endTime) &&
      hoursBetween(anchor, slot.endTime) <= MAX_BOOKING_HOURS
    ) {
      setRangeEnd(slot.endTime);
    } else {
      setAnchor(slot.startTime);
      setRangeEnd(null);
    }
  }

  const selectionStart = anchor;
  const selectionEnd = anchor
    ? (rangeEnd ?? slotEndByStart.get(anchor) ?? null)
    : null;
  const hasSelection = selectionStart !== null && selectionEnd !== null;
  const selectedHours =
    selectionStart && selectionEnd
      ? hoursBetween(selectionStart, selectionEnd)
      : 0;

  const confirmHref =
    selectionStart && selectionEnd
      ? `/resources/${resourceId}?date=${encodeURIComponent(date)}&startTime=${encodeURIComponent(
          selectionStart,
        )}&endTime=${encodeURIComponent(selectionEnd)}`
      : "#";

  return (
    <div>
      <p className={styles.pickerHint} id="slot-picker-hint">
        Click a start hour, then a later hour to book a multi-hour session, up
        to {MAX_BOOKING_HOURS} hours. Bookings run between 08:00 and 18:00 ICT
        (UTC+7).
      </p>
      <div
        className={styles.slotGrid}
        role="group"
        aria-label="Available time slots"
        aria-describedby="slot-picker-hint"
      >
        {slots.map((slot) => {
          const inRange =
            hasSelection &&
            slot.startTime >= (selectionStart as string) &&
            slot.endTime <= (selectionEnd as string);
          return (
            <button
              key={slot.startTime}
              type="button"
              aria-pressed={inRange}
              aria-label={`${slot.startTime} to ${slot.endTime}`}
              onClick={() => handleSelect(slot)}
            >
              <span>{slot.startTime}</span>
              <small>to {slot.endTime}</small>
            </button>
          );
        })}
      </div>

      {hasSelection && (
        <div className={styles.pickerSelection} role="status">
          <p>
            <strong>
              {selectionStart}–{selectionEnd} selected
            </strong>{" "}
            · {selectedHours} {selectedHours === 1 ? "hour" : "hours"}. This does
            not reserve or hold the resource.
          </p>
          <div className={styles.pickerActions}>
            <Link className={styles.pickerConfirm} href={confirmHref}>
              Use {selectionStart}–{selectionEnd}
            </Link>
            <button
              type="button"
              className={styles.pickerClear}
              onClick={() => {
                setAnchor(null);
                setRangeEnd(null);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
