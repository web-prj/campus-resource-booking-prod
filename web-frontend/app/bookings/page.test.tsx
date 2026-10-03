import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudentBookings } from "@/features/bookings/api/server";
import BookingsPage from "./page";

vi.mock("@/features/bookings/api/server", () => ({
  getStudentBookings: vi.fn(),
}));

const timeline = { upcoming: [], history: [] };

describe("BookingsPage", () => {
  beforeEach(() => {
    vi.mocked(getStudentBookings).mockReset();
  });

  it("passes the authoritative timeline to the ledger", async () => {
    vi.mocked(getStudentBookings).mockResolvedValue(timeline);

    const page = await BookingsPage();

    expect(getStudentBookings).toHaveBeenCalledOnce();
    expect(page.props).toEqual({ timeline });
  });
});
