import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudentBooking } from "@/features/bookings/api/server";
import { notFound } from "next/navigation";
import BookingDetailPage from "./page";

vi.mock("@/features/bookings/api/server", () => ({
  getStudentBooking: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

const id = "40000000-0000-4000-8000-000000000001";
const booking = {
  id,
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh" as const,
  status: "confirmed" as const,
  canCancel: true,
  hasEnded: false,
  cancelledAt: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  resource: {
    id: "20000000-0000-4000-8000-000000000001",
    code: "ROOM-A101",
    name: "Study Room A101",
    type: "room" as const,
    location: "First floor",
    buildingCode: "MAIN",
    buildingName: "Main Academic Building",
  },
};

function pageParams(value = id) {
  return { params: Promise.resolve({ id: value }) };
}

describe("BookingDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getStudentBooking).mockReset();
    vi.mocked(notFound).mockClear();
  });

  it("rejects an invalid booking identifier before any data lookup", async () => {
    await expect(BookingDetailPage(pageParams("invalid"))).rejects.toThrow(
      "notFound",
    );
    expect(getStudentBooking).not.toHaveBeenCalled();
  });

  it("returns not found when the booking lookup has no result", async () => {
    vi.mocked(getStudentBooking).mockResolvedValue(null);

    await expect(BookingDetailPage(pageParams())).rejects.toThrow("notFound");
    expect(getStudentBooking).toHaveBeenCalledWith(id);
  });

  it("passes the owned booking to the detail flow", async () => {
    vi.mocked(getStudentBooking).mockResolvedValue(booking);

    const page = await BookingDetailPage(pageParams());

    expect(page.props).toEqual({ booking });
  });
});
