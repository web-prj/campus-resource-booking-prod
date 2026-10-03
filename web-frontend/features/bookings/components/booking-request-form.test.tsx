import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingRequestError,
  createBookingRequest,
} from "../api/browser";
import { BookingRequestForm } from "./booking-request-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("../api/browser", () => ({
  createBookingRequest: vi.fn(),
  BookingRequestError: class BookingRequestError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const mockedCreate = vi.mocked(createBookingRequest);
const input = {
  resourceId: "20000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
};

function renderForm() {
  return render(
    <BookingRequestForm resourceName="Study Room A101" input={input} />,
  );
}

describe("BookingRequestForm", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    refresh.mockReset();
  });

  it("shows the selected interval and locks duplicate submission", async () => {
    let resolveBooking!: (value: Awaited<ReturnType<typeof createBookingRequest>>) => void;
    mockedCreate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBooking = resolve;
        }),
    );
    renderForm();

    expect(screen.getByText("Study Room A101")).toBeVisible();
    expect(screen.getByText("09:00–10:00 ICT (UTC+7)")).toBeVisible();
    expect(screen.getByText("Immediate confirmation")).toBeVisible();
    const button = screen.getByRole("button", { name: "Send booking request" });
    await userEvent.dblClick(button);

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(input);
    expect(screen.getByRole("button", { name: "Sending request…" })).toBeDisabled();

    resolveBooking({
      id: "40000000-0000-4000-8000-000000000001",
      ...input,
      timeZone: "Asia/Ho_Chi_Minh",
      status: "confirmed",
      createdAt: "2026-09-15T00:00:00.000Z",
    });
    expect(await screen.findByText("Booking confirmed.")).toBeVisible();
    expect(screen.getByText("Confirmed")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByText("Booking confirmed.").parentElement).toHaveFocus(),
    );
    expect(screen.getByRole("link", { name: "View booking" })).toHaveAttribute(
      "href",
      "/bookings/40000000-0000-4000-8000-000000000001",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("announces the confirmed booking and replaces the pre-submit badge", async () => {
    mockedCreate.mockResolvedValue({
      id: "40000000-0000-4000-8000-000000000001",
      ...input,
      timeZone: "Asia/Ho_Chi_Minh",
      status: "confirmed",
      createdAt: "2026-09-15T00:00:00.000Z",
    });
    renderForm();
    expect(screen.getByText("Immediate confirmation")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: "Send booking request" }),
    );

    expect(await screen.findByText("Booking confirmed.")).toBeVisible();
    expect(screen.getByText("Confirmed")).toBeVisible();
    expect(screen.queryByText("Immediate confirmation")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Booking confirmed.").parentElement).toHaveFocus(),
    );
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });

  it("focuses an actionable conflict and refreshes availability", async () => {
    mockedCreate.mockRejectedValue(
      new BookingRequestError(
        "conflict",
        "This time is no longer bookable. Choose another slot and try again.",
      ),
    );
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Send booking request" }),
    );

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(alert).toHaveTextContent("no longer bookable");
    expect(refresh).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh availability" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });

  it("explains an unavailable selection without offering submission", () => {
    render(
      <BookingRequestForm
        resourceName="Study Room A101"
        isSlotAvailable={false}
        chooseAnotherHref="/resources/20000000-0000-4000-8000-000000000001?date=2099-01-05"
        input={input}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("09:00–10:00 is no longer available.");
    expect(status).toHaveTextContent("No new request was sent.");
    expect(
      screen.getByRole("heading", { name: "Selected time unavailable" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Choose another slot" })).toHaveAttribute(
      "href",
      "/resources/20000000-0000-4000-8000-000000000001?date=2099-01-05",
    );
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Selecting a slot does not hold it/)).not.toBeInTheDocument();
  });

  it("does not show the unavailable notice for an available selection", () => {
    renderForm();
    expect(screen.queryByText(/no longer available/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send booking request" }),
    ).toBeEnabled();
  });
});
