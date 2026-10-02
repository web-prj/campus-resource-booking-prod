import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import {
  BookingRequestError,
  cancelStudentBooking,
} from "../api/browser";
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
const user: User = {
  id: "30000000-0000-4000-8000-000000000001",
  email: "student@usth.edu.vn",
  fullName: "Campus Student",
  role: "student",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const booking: StudentBooking = {
  id: "40000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "11:00",
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  canCancel: true,
  canRequestCheckIn: false,
  hasEnded: false,
  checkInCode: null,
  checkInRequestedAt: null,
  checkedInAt: null,
  checkedOutAt: null,
  noShowAt: null,
  checkInDeadline: "2099-01-05T04:00:00.000Z",
  releasedAutomatically: false,
  cancelledAt: null,
  reviewedAt: null,
  rejectionReason: null,
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

  it("separates upcoming, pending, and historical status clearly", () => {
    const timeline: StudentBookingTimeline = {
      upcoming: [booking, { ...booking, id: "40000000-0000-4000-8000-000000000002", status: "pending" }],
      history: [{
        ...booking,
        id: "40000000-0000-4000-8000-000000000003",
        status: "cancelled",
        canCancel: false,
        cancelledAt: "2026-09-16T01:00:00.000Z",
      }],
    };
    render(<StudentBookings user={user} timeline={timeline} />);

    expect(screen.getByRole("heading", { name: "Upcoming and pending" })).toBeVisible();
    expect(screen.getByText("Confirmed upcoming").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("Awaiting approval").previousSibling).toHaveTextContent("1");
    expect(screen.getAllByText("Pending approval")).toHaveLength(1);
    expect(screen.getAllByText("Cancelled")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /View details/ })).toHaveLength(3);
  });

  it("shows a full confirmation only for an active confirmed booking", () => {
    const view = render(<StudentBookingDetail user={user} booking={booking} />);
    const confirmation = screen.getByRole("region", { name: "Booking confirmation" });
    expect(confirmation).toHaveTextContent(user.fullName);
    expect(confirmation).toHaveTextContent(user.email);
    expect(confirmation).toHaveTextContent(booking.id);
    expect(confirmation).toHaveTextContent("ROOM-A101 · Study Room A101");
    expect(confirmation).toHaveTextContent("MAIN · Main Academic Building · First floor");
    expect(confirmation).toHaveTextContent("09:00–11:00 ICT");
    expect(confirmation).toHaveTextContent("current status in their system");
    expect(screen.queryByRole("button", { name: /Generate check-in code/ })).not.toBeInTheDocument();
    view.rerender(<StudentBookingDetail key="pending" user={user} booking={{ ...booking, status: "pending" }} />);
    expect(screen.queryByRole("region", { name: "Booking confirmation" })).not.toBeInTheDocument();
    view.rerender(<StudentBookingDetail key="ended" user={user} booking={{ ...booking, hasEnded: true, canCancel: false }} />);
    expect(screen.queryByRole("region", { name: "Booking confirmation" })).not.toBeInTheDocument();
  });

  it("does not present a stale confirmed booking as valid after the check-in deadline", () => {
    render(<StudentBookingDetail user={user} booking={{ ...booking, canCancel: false, checkInDeadline: "2020-01-01T00:00:00.000Z" }} />);
    expect(screen.queryByRole("region", { name: "Booking confirmation" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Check-in window ended" })).toBeVisible();
    expect(screen.getByText(/remains confirmed until the system marks you absent/)).toBeVisible();
  });

  it("tells the student when staff check-in closes and that the booking is then released", () => {
    render(<StudentBookingDetail user={user} booking={booking} />);
    expect(screen.getByText(/can confirm your arrival from the scheduled start until the end at 11:00/)).toBeVisible();
  });

  it("explains a booking released because check-in was missed", () => {
    render(
      <StudentBookingDetail
        user={user}
        booking={{
          ...booking,
          status: "no_show",
          canCancel: false,
          noShowAt: "2099-01-05T04:00:00.000Z",
          releasedAutomatically: true,
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Released: check-in was not confirmed in time" }),
    ).toBeVisible();
    expect(screen.getByText(/had not checked you in by the scheduled end at 11:00/)).toBeVisible();
  });

  it("explains a passed review deadline without claiming a pending slot was released", () => {
    render(
      <StudentBookingDetail
        user={user}
        booking={{ ...booking, status: "pending", canCancel: false, hasEnded: true }}
      />,
    );

    expect(screen.getAllByText("Review window ended")).toHaveLength(3);
    expect(screen.getByText(/still pending release, so its slot may remain held/)).toBeVisible();
    expect(screen.queryByText("Expired request")).not.toBeInTheDocument();
  });

  it("explains a request that expired at its check-in deadline", () => {
    render(
      <StudentBookingDetail
        user={user}
        booking={{ ...booking, status: "expired", canCancel: false }}
      />,
    );
    expect(screen.getAllByText("Expired request")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Request expired without review" }),
    ).toBeVisible();
    expect(
      screen.getByText(/before its scheduled end, so it was never approved/),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
  });

  it("tells the student when an unreviewed request will expire", () => {
    render(
      <StudentBookingDetail
        user={user}
        booking={{ ...booking, status: "pending" }}
      />,
    );
    expect(
      screen.getByText(/If nobody approves it by the scheduled end at 11:00, the request expires/),
    ).toBeVisible();
  });

  it("shows an unended pending request past the deadline as awaiting release", () => {
    render(<StudentBookingDetail user={user} booking={{ ...booking, status: "pending", canCancel: false, checkInDeadline: "2020-01-01T00:00:00.000Z" }} />);
    expect(screen.getAllByText("Review window ended")).toHaveLength(3);
    expect(screen.getByText(/still pending release, so its slot may remain held/)).toBeVisible();
  });

  it("keeps an unended pending request labelled as pending approval", () => {
    render(
      <StudentBookingDetail
        user={user}
        booking={{ ...booking, status: "pending" }}
      />,
    );
    expect(screen.getAllByText("Pending approval")).toHaveLength(2);
    expect(screen.queryByText("Expired request")).not.toBeInTheDocument();
  });

  it("explains elapsed active lifecycle statuses without presenting upcoming actions", () => {
    render(
      <StudentBookingDetail
        user={user}
        booking={{ ...booking, canCancel: false, hasEnded: true }}
      />,
    );

    expect(screen.getByText("Booking time ended")).toBeVisible();
    expect(
      screen.getByText(/ended without a confirmed check-in, so the booking will be recorded as absent/),
    ).toBeVisible();
    expect(screen.queryByText(/Check-in opens/)).not.toBeInTheDocument();
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
    render(<StudentBookingDetail user={user} booking={booking} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Cancel booking" }),
    );
    expect(screen.getByText("Release this time slot?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep booking" })).toHaveFocus();
    expect(mockedCancel).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));
    expect(mockedCancel).toHaveBeenCalledWith(booking.id);
    expect(await screen.findByText("This booking was cancelled")).toBeVisible();
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

  it.each([
    [
      "session" as const,
      "Your session has ended. Sign in again before managing this booking.",
      "Sign in again",
    ],
    [
      "conflict" as const,
      "This booking can no longer be cancelled. Refresh its details.",
      "Refresh booking details",
    ],
  ])(
    "focuses a %s cancellation error and offers recovery",
    async (code, message, recoveryName) => {
      mockedCancel.mockRejectedValue(new BookingRequestError(code, message));
      render(<StudentBookingDetail user={user} booking={booking} />);
      await userEvent.click(
        screen.getByRole("button", { name: "Cancel booking" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Yes, cancel" }));

      const alert = await screen.findByRole("alert");
      await waitFor(() => expect(alert).toHaveFocus());
      if (code === "session") {
        expect(screen.getByRole("link", { name: recoveryName })).toHaveAttribute(
          "href",
          `/login?next=%2Fbookings%2F${booking.id}`,
        );
      } else {
        await userEvent.click(
          screen.getByRole("button", { name: recoveryName }),
        );
        expect(refresh).toHaveBeenCalledOnce();
      }
    },
  );

  it("uses a fresh client instance for an authoritative booking update", () => {
    const cancelled = {
      ...booking,
      status: "cancelled" as const,
      canCancel: false,
      cancelledAt: "2026-09-16T01:00:00.000Z",
    };
    const view = render(
      <StudentBookingDetail key="confirmed" user={user} booking={booking} />,
    );
    expect(screen.getByText("Show your booking confirmation to staff")).toBeVisible();

    view.rerender(
      <StudentBookingDetail
        key="cancelled"
        user={user}
        booking={cancelled}
      />,
    );

    expect(screen.getByText("This booking was cancelled")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Cancel booking" }),
    ).not.toBeInTheDocument();
  });
});
