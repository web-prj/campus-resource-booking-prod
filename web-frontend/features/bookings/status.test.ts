import { describe, expect, it } from "vitest";
import { isExpiredRequest, studentDisplayStatus, studentStatusLabel } from "./status";

describe("student booking display status", () => {
  it("distinguishes a closed review window from a persisted expired request", () => {
    const pending = { status: "pending" as const, hasEnded: false, checkInDeadline: "2020-01-01T00:00:00.000Z" };
    expect(isExpiredRequest(pending)).toBe(false);
    expect(studentDisplayStatus(pending)).toBe("review_closed");
    expect(studentStatusLabel(pending)).toBe("Review window ended");
    expect(studentStatusLabel({ ...pending, status: "expired" })).toBe("Expired request");
  });

  it("keeps future and other lifecycle statuses unchanged", () => {
    const future = { checkInDeadline: "2099-01-01T00:00:00.000Z", hasEnded: false };
    expect(studentStatusLabel({ ...future, status: "pending" })).toBe("Pending approval");
    expect(studentStatusLabel({ ...future, status: "confirmed", hasEnded: true })).toBe("Confirmed");
    expect(isExpiredRequest({ status: "rejected" })).toBe(false);
  });
});
