import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingRequestError, cancelStudentBooking } from "../api/browser";
import type { StudentBooking, StudentBookingTimeline } from "../types";
import { StudentBookingDetail, StudentBookings } from "./student-bookings";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/browser", () => ({
  cancelStudentBooking: vi.fn(),
  BookingRequestError: class BookingRequestError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const mockedCancel = vi.mocked(cancelStudentBooking);
const booking: StudentBooking = {
  id: "40000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "11:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  canCancel: true,
  hasEnded: false,
  cancelledAt: null,
  createdAt: "2026-09-15T01:00:00.000Z",
  resource: {
    id: "20000000-0000-4000-8000-000000000001",
    code: "ROOM-A101",
    name: "Study Room A101",
    type: "room",
    location: "First floor",
    buildingCode: "MAIN",
    buildingName: "Main Academic Building",
  },
};

describe("student booking management", () => {
  beforeEach(() => {
    mockedCancel.mockReset();
    refresh.mockReset();
  });

  it("summarizes upcoming, cancelled, and history counts", () => {
    const timeline: StudentBookingTimeline = {
      upcoming: [
        booking,
        { ...booking, id: "40000000-0000-4000-8000-000000000002" },
      ],
      history: [
        {
          ...booking,
          id: "40000000-0000-4000-8000-000000000003",
          status: "cancelled",
          canCancel: false,
          cancelledAt: "2026-09-16T01:00:00.000Z",
        },
      ],
    };
    render(<StudentBookings timeline={timeline} />);

    expect(
      screen.getByRole("heading", { name: "Upcoming bookings" }),
    ).toBeVisible();
    expect(screen.getByText("Confirmed upcoming").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("Cancelled bookings").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("History entries").previousSibling).toHaveTextContent("1");
    expect(screen.getAllByRole("link", { name: /View details/ })).toHaveLength(3);
  });

  it("describes an open confirmed booking with a cancel action", () => {
    render(<StudentBookingDetail booking={booking} />);
    expect(
      screen.getByRole("heading", { name: "Booking confirmed" }),
    ).toBeVisible();
    expect(
      screen.getByText(/This room is reserved for you/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cancel booking" }),
    ).toBeVisible();
  });

  it("explains an ended confirmed booking without upcoming actions", () => {
    render(
      <StudentBookingDetail
        booking={{ ...booking, canCancel: false, hasEnded: true }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Booking time ended" }),
    ).toBeVisible();
    expect(
      screen.getByText(/now in your history/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
  });

  it("requires confirmation and reflects a successful cancellation", async () => {
    const cancelled: StudentBooking = {
      ...booking,
      status: "cancelled",
      canCancel: false,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    };
    mockedCancel.mockResolvedValue(cancelled);
    render(<StudentBookingDetail booking={booking} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Cancel booking" }),
    );
    expect(screen.getByText("Release this time slot?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep booking" })).toHaveFocus();
    expect(mockedCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    expect(mockedCancel).toHaveBeenCalledWith(booking.id);
    expect(
      await screen.findByRole("heading", { name: "This booking was cancelled" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "This booking was cancelled" }),
      ).toHaveFocus(),
    );
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("focuses a conflict cancellation error and offers a refresh", async () => {
    mockedCancel.mockRejectedValue(
      new BookingRequestError(
        "conflict",
        "This booking can no longer be cancelled. Refresh its details.",
      ),
    );
    render(<StudentBookingDetail booking={booking} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel booking" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(
      screen.queryByRole("link", { name: "Sign in again" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh booking details" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("renders an authoritative booking update when remounted", () => {
    const cancelled = {
      ...booking,
      status: "cancelled" as const,
      canCancel: false,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    };
    const view = render(
      <StudentBookingDetail key="confirmed" booking={booking} />,
    );
    expect(
      screen.getByRole("heading", { name: "Booking confirmed" }),
    ).toBeVisible();

    view.rerender(
      <StudentBookingDetail key="cancelled" booking={cancelled} />,
    );

    expect(
      screen.getByRole("heading", { name: "This booking was cancelled" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
  });
});
