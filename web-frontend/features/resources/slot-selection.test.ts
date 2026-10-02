import { describe, expect, it } from "vitest";
import { MAX_BOOKING_HOURS, resolveSlotSelection } from "./slot-selection";
import type { ResourceAvailability } from "./types";

function availability(): ResourceAvailability {
  return {
    resourceId: "20000000-0000-4000-8000-000000000001",
    date: "2099-01-05",
    timeZone: "Asia/Ho_Chi_Minh",
    status: "active",
    operatingDays: [1, 2, 3, 4, 5, 6],
    opensAt: "08:00",
    closesAt: "18:00",
    blockedReason: null,
    closureReason: null,
    requiresApproval: false,
    // 08:00–14:00 as contiguous hourly slots.
    slots: Array.from({ length: 6 }, (_, index) => ({
      startTime: `${String(index + 8).padStart(2, "0")}:00`,
      endTime: `${String(index + 9).padStart(2, "0")}:00`,
    })),
  };
}

describe("resolveSlotSelection max duration", () => {
  it("accepts a contiguous range exactly at the maximum length", () => {
    const selection = resolveSlotSelection(availability(), "08:00", "11:00");
    expect(selection.selectedSlot).toEqual({
      startTime: "08:00",
      endTime: "11:00",
    });
    expect(selection.isSlotAvailable).toBe(true);
  });

  it("selects nothing when the range exceeds the maximum length", () => {
    const selection = resolveSlotSelection(availability(), "08:00", "12:00");
    expect(MAX_BOOKING_HOURS).toBe(3);
    expect(selection.selectedSlot).toBeUndefined();
    expect(selection.isSlotAvailable).toBe(false);
  });
});
