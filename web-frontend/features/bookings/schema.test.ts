import { describe, expect, it } from "vitest";
import {
  parseBookingRequestResult,
  parseStudentBooking,
  parseStudentBookingTimeline,
} from "./schema";

const input = {
  resourceId: "20000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
};
const result = {
  id: "40000000-0000-4000-8000-000000000001",
  ...input,
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  createdAt: "2026-09-15T00:00:00.000Z",
};

const resource = {
  id: input.resourceId,
  code: "ROOM-A101",
  name: "Study Room A101",
  type: "room",
  location: "First floor",
  buildingCode: "MAIN",
  buildingName: "Main Academic Building",
};

const studentBooking = {
  id: "50000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  canCancel: true,
  hasEnded: false,
  cancelledAt: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  resource,
};

describe("booking response schema", () => {
  it("parses a confirmed booking response", () => {
    expect(parseBookingRequestResult(result, input)).toEqual(result);
  });

  it.each([
    { ...result, id: "bad" },
    { ...result, resourceId: "20000000-0000-4000-8000-000000000002" },
    { ...result, date: "2099-01-06" },
    { ...result, startTime: "10:00" },
    { ...result, endTime: "11:00" },
    { ...result, status: "pending" },
    { ...result, status: "cancelled" },
    { ...result, timeZone: "UTC" },
    { ...result, createdAt: "bad" },
  ])("rejects malformed or out-of-scope booking data %j", (value) => {
    expect(parseBookingRequestResult(value, input)).toBeNull();
  });
});

describe("student booking schema", () => {
  it("accepts an open confirmed booking", () => {
    expect(parseStudentBooking(studentBooking)).toEqual(studentBooking);
  });

  it("accepts a cancelled booking with its timestamp", () => {
    const cancelled = {
      ...studentBooking,
      status: "cancelled",
      canCancel: false,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    };
    expect(parseStudentBooking(cancelled)).toEqual(cancelled);
  });

  it.each([
    // Unknown lifecycle statuses are no longer supported.
    { ...studentBooking, status: "checked_in" },
    { ...studentBooking, status: "no_show", canCancel: false },
    // An ended booking cannot still be cancellable.
    { ...studentBooking, hasEnded: true },
    // A confirmed booking never carries a cancellation timestamp.
    { ...studentBooking, cancelledAt: "2026-09-16T01:00:00.000Z" },
    // Cancelled must carry a cancellation timestamp and not be cancellable.
    { ...studentBooking, status: "cancelled", cancelledAt: null },
    { ...studentBooking, status: "cancelled", canCancel: true, cancelledAt: "2026-09-16T01:00:00.000Z" },
    // Invalid cancellation timestamp.
    { ...studentBooking, status: "cancelled", canCancel: false, cancelledAt: "not a time" },
    // Unknown resource type.
    { ...studentBooking, resource: { ...resource, type: "laboratory" } },
  ])("rejects inconsistent student booking data %#", (value) => {
    expect(parseStudentBooking(value)).toBeNull();
  });
});

describe("student booking timeline schema", () => {
  it.each([
    { ...studentBooking, status: "confirmed", canCancel: false, hasEnded: true },
    {
      ...studentBooking,
      status: "cancelled",
      canCancel: false,
      hasEnded: true,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    },
  ])("accepts an ended or cancelled booking in authoritative history", (base) => {
    const historical = { ...base, id: "50000000-0000-4000-8000-000000000002" };
    expect(
      parseStudentBookingTimeline({ upcoming: [], history: [historical] }),
    ).toEqual({ upcoming: [], history: [historical] });
  });

  it("rejects terminal statuses in upcoming, duplicate IDs, and unstable ordering", () => {
    const cancelled = {
      ...studentBooking,
      status: "cancelled",
      canCancel: false,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    };
    expect(
      parseStudentBookingTimeline({ upcoming: [cancelled], history: [] }),
    ).toBeNull();
    // An active, not-yet-ended booking cannot sit in history.
    expect(
      parseStudentBookingTimeline({ upcoming: [], history: [studentBooking] }),
    ).toBeNull();
    // Duplicate IDs across the timeline.
    expect(
      parseStudentBookingTimeline({
        upcoming: [
          studentBooking,
          { ...studentBooking, date: "2099-01-06" },
        ],
        history: [],
      }),
    ).toBeNull();
    // Upcoming must be chronological ascending.
    expect(
      parseStudentBookingTimeline({
        upcoming: [
          { ...studentBooking, date: "2099-01-06" },
          { ...studentBooking, id: "50000000-0000-4000-8000-000000000002" },
        ],
        history: [],
      }),
    ).toBeNull();
  });
});
