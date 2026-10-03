import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createBookingRequest } from "@/features/bookings/api/browser";
import type { Resource, ResourceAvailability } from "../types";
import { ResourceDetail } from "./resource-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/bookings/api/browser", () => ({
  createBookingRequest: vi.fn(),
  BookingRequestError: class BookingRequestError extends Error {},
}));

const mockedCreateBooking = vi.mocked(createBookingRequest);

const resource: Resource = {
  id: "20000000-0000-4000-8000-000000000003",
  code: "ROOM-B204",
  name: "Seminar Room B204",
  description: "A supervised room for scheduled practical sessions.",
  type: "room",
  status: "active",
  capacity: 24,
  location: "Second floor",
  amenities: ["workstations", "projector screen"],
  requiresApproval: true,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building: {
    id: "10000000-0000-4000-8000-000000000002",
    code: "SCI",
    name: "Science Building",
    address: "USTH Campus, Hanoi",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ResourceDetail", () => {
  it("renders location, capacity, amenities, and approval rules", () => {
    render(<ResourceDetail resource={resource} />);

    expect(
      screen.getByRole("heading", { name: "Seminar Room B204" }),
    ).toBeVisible();
    expect(screen.getByText("24 places")).toBeVisible();
    expect(screen.getByText("Staff approval required")).toBeVisible();
    expect(screen.getByText("workstations")).toBeVisible();
    expect(screen.getByText("projector screen")).toBeVisible();
    expect(screen.getByText("USTH Campus, Hanoi")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to resource directory" }),
    ).toHaveAttribute("href", "/resources");
    expect(
      screen.queryByRole("heading", { name: "Compare campus resources" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Compare other resources" }),
    ).not.toBeInTheDocument();
  });

  it("prompts for a date and accurately limits operational availability", () => {
    render(<ResourceDetail resource={resource} />);

    expect(
      screen.getByRole("heading", { name: "Check availability" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date");
    expect(screen.getByRole("button", { name: "Check date" })).toBeVisible();
    expect(screen.getByRole("link", { name: "My bookings" })).toHaveAttribute(
      "href",
      "/bookings",
    );
    expect(
      screen.getByText(/policy and availability are checked again/i),
    ).toBeVisible();
  });

  it("uses the dated availability snapshot for operational facts and approval", () => {
    render(
      <ResourceDetail
        resource={{ ...resource, requiresApproval: false }}
        checkedDate="2099-01-05"
        selectedSlot={{ startTime: "10:00", endTime: "11:00" }}
        availability={{
          resourceId: resource.id,
          date: "2099-01-05",
          timeZone: "Asia/Ho_Chi_Minh",
          status: "active",
          operatingDays: [1, 3, 5],
          opensAt: "10:00",
          closesAt: "12:00",
          blockedReason: null,
          closureReason: null,
          requiresApproval: true,
          slots: [
            { startTime: "10:00", endTime: "11:00" },
            { startTime: "11:00", endTime: "12:00" },
          ],
        }}
      />,
    );

    expect(screen.getByText("Mon, Wed, Fri · 10:00–12:00 ICT (UTC+7)")).toBeVisible();
    expect(
      screen.getAllByText(/staff approval required/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/When this date was checked, the resource required staff approval/),
    ).toBeVisible();
    expect(screen.queryByText(/No staff approval is required/)).not.toBeInTheDocument();
  });

  it("renders authoritative hourly slots and a non-reservation selection", () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2026-09-15",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "active",
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "08:00", endTime: "09:00" },
        { startTime: "09:00", endTime: "10:00" },
      ],
    };

    render(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={{ startTime: "09:00", endTime: "10:00" }}
      />,
    );

    expect(screen.getByText("2 operational hourly slots")).toBeVisible();
    expect(
      screen.getByText(/Confirmed bookings are excluded/),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "08:00 to 09:00" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "09:00 to 10:00" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("link", { name: "Use 09:00–10:00" }),
    ).toHaveAttribute(
      "href",
      `/resources/${resource.id}?date=2026-09-15&startTime=09%3A00&endTime=10%3A00`,
    );
    expect(screen.getByText(/does not reserve or hold/)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Request this resource" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send booking request" }),
    ).toBeVisible();
  });

  it("lets a student select a multi-hour range across the slot grid", async () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "active",
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
        { startTime: "11:00", endTime: "12:00" },
      ],
    };

    render(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "09:00 to 10:00" }));
    await userEvent.click(screen.getByRole("button", { name: "11:00 to 12:00" }));

    expect(screen.getByText(/09:00–12:00 selected/)).toBeVisible();
    expect(screen.getByText(/· 3 hours/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "10:00 to 11:00" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("link", { name: "Use 09:00–12:00" }),
    ).toHaveAttribute(
      "href",
      `/resources/${resource.id}?date=2099-01-05&startTime=09%3A00&endTime=12%3A00`,
    );
  });

  it("grows a range to 3 hours by clicking successive blocks", async () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "active",
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
        { startTime: "11:00", endTime: "12:00" },
        { startTime: "12:00", endTime: "13:00" },
      ],
    };

    render(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "09:00 to 10:00" }));
    await userEvent.click(screen.getByRole("button", { name: "10:00 to 11:00" }));
    expect(screen.getByText(/09:00–11:00 selected/)).toBeVisible();
    // A third successive block must reach 3 hours, not reset the selection.
    await userEvent.click(screen.getByRole("button", { name: "11:00 to 12:00" }));

    expect(screen.getByText(/09:00–12:00 selected/)).toBeVisible();
    expect(screen.getByText(/· 3 hours/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Use 09:00–12:00" }),
    ).toHaveAttribute(
      "href",
      `/resources/${resource.id}?date=2099-01-05&startTime=09%3A00&endTime=12%3A00`,
    );
  });

  it("caps selection at 3 hours, restarting when a longer span is clicked", async () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "active",
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
        { startTime: "11:00", endTime: "12:00" },
        { startTime: "12:00", endTime: "13:00" },
        { startTime: "13:00", endTime: "14:00" },
      ],
    };

    render(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "09:00 to 10:00" }));
    // 09:00–14:00 would be 5 hours; the picker restarts at the clicked slot.
    await userEvent.click(screen.getByRole("button", { name: "13:00 to 14:00" }));

    expect(screen.getByText(/13:00–14:00 selected/)).toBeVisible();
    expect(screen.queryByText(/09:00–14:00 selected/)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Use 13:00–14:00" }),
    ).toHaveAttribute(
      "href",
      `/resources/${resource.id}?date=2099-01-05&startTime=13%3A00&endTime=14%3A00`,
    );
  });

  it("submits a validated multi-hour interval", () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "active",
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
      ],
    };

    render(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={{ startTime: "09:00", endTime: "11:00" }}
      />,
    );

    expect(screen.getByText("09:00–11:00 ICT (UTC+7)")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send booking request" }),
    ).toBeEnabled();
  });

  it("remounts a dirty date from canonical URL state after slot navigation", () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "active",
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [{ startTime: "09:00", endTime: "10:00" }],
    };
    const view = render(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
      />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2099-01-06" },
    });

    view.rerender(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={availability.slots[0]}
      />,
    );

    expect(screen.getByLabelText("Date")).toHaveValue("2099-01-05");
  });

  it("resets booking state when another slot is selected", async () => {
    const availability: ResourceAvailability = {
      resourceId: resource.id,
      date: "2099-01-05",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "active",
      operatingDays: [1, 2, 3, 4, 5, 6],
      opensAt: "08:00",
      closesAt: "18:00",
      blockedReason: null,
      closureReason: null,
      requiresApproval: true,
      slots: [
        { startTime: "09:00", endTime: "10:00" },
        { startTime: "10:00", endTime: "11:00" },
      ],
    };
    mockedCreateBooking.mockResolvedValueOnce({
      id: "40000000-0000-4000-8000-000000000001",
      resourceId: resource.id,
      date: availability.date,
      startTime: "09:00",
      endTime: "10:00",
      timeZone: "Asia/Ho_Chi_Minh",
      status: "confirmed",
      createdAt: "2026-09-15T00:00:00.000Z",
    });
    const view = render(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={availability.slots[0]}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Send booking request" }),
    );
    expect(await screen.findByText("Booking confirmed.")).toBeVisible();

    view.rerender(
      <ResourceDetail
        resource={resource}
        availability={availability}
        checkedDate={availability.date}
        selectedSlot={availability.slots[1]}
      />,
    );

    expect(screen.getByText("10:00–11:00 ICT (UTC+7)")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send booking request" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Booking confirmed."),
    ).not.toBeInTheDocument();
  });

  it("explains when bookings occupy every operational slot", () => {
    render(
      <ResourceDetail
        resource={resource}
        checkedDate="2099-01-05"
        availability={{
          resourceId: resource.id,
          date: "2099-01-05",
          timeZone: "Asia/Ho_Chi_Minh",
          status: "active",
          operatingDays: [1, 2, 3, 4, 5, 6],
          opensAt: "08:00",
          closesAt: "18:00",
          blockedReason: null,
          closureReason: null,
          requiresApproval: true,
          slots: [],
        }}
      />,
    );

    expect(screen.getByText("No bookable hourly slots remain")).toBeVisible();
    expect(
      screen.getByText(/has elapsed or is occupied/),
    ).toBeVisible();
    expect(screen.queryByLabelText("Available time slots")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });

  it("renders closure reasons without fabricating slots", () => {
    render(
      <ResourceDetail
        resource={resource}
        checkedDate="2026-09-18"
        availability={{
          resourceId: resource.id,
          date: "2026-09-18",
          timeZone: "Asia/Ho_Chi_Minh",
          status: "active",
          operatingDays: [1, 2, 3, 4, 5, 6],
          opensAt: "08:00",
          closesAt: "18:00",
          blockedReason: "closure",
          closureReason: "Campus maintenance",
          requiresApproval: true,
          slots: [],
        }}
      />,
    );

    expect(screen.getByText("No operational availability")).toBeVisible();
    expect(screen.getByText("Closure reason: Campus maintenance")).toBeVisible();
    expect(screen.queryByLabelText("Available time slots")).not.toBeInTheDocument();
  });

  it("shows approval policy and a useful amenities fallback", () => {
    render(
      <ResourceDetail
        resource={{
          ...resource,
          id: "20000000-0000-4000-8000-000000000004",
          type: "room",
          name: "Meeting Room C110",
          capacity: 1,
          description: null,
          amenities: [],
          requiresApproval: false,
        }}
      />,
    );

    expect(screen.getByText("1 place")).toBeVisible();
    expect(screen.getByText("No staff approval required")).toBeVisible();
    expect(
      screen.getByText(/No additional description has been provided/),
    ).toBeVisible();
    expect(
      screen.getByText(/No additional amenities are listed/),
    ).toBeVisible();
  });

  it("explains a selected interval that is no longer available", () => {
    render(
      <ResourceDetail
        resource={resource}
        checkedDate="2099-01-05"
        selectedSlot={{ startTime: "09:00", endTime: "11:00" }}
        isSlotAvailable={false}
        availability={{
          resourceId: resource.id,
          date: "2099-01-05",
          timeZone: "Asia/Ho_Chi_Minh",
          status: "active",
          operatingDays: [1, 2, 3, 4, 5, 6],
          opensAt: "08:00",
          closesAt: "18:00",
          blockedReason: null,
          closureReason: null,
          requiresApproval: true,
          slots: [
            { startTime: "09:00", endTime: "10:00" },
            { startTime: "14:00", endTime: "15:00" },
          ],
        }}
      />,
    );

    expect(screen.getByText("09:00–11:00 is no longer available.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Choose another slot" })).toHaveAttribute(
      "href",
      `/resources/${resource.id}?date=2099-01-05`,
    );
    expect(screen.queryByText(/selected ·/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "09:00 to 10:00" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });

  it("explains an unavailable selection even when no slots remain", () => {
    render(
      <ResourceDetail
        resource={resource}
        checkedDate="2099-01-05"
        selectedSlot={{ startTime: "09:00", endTime: "10:00" }}
        isSlotAvailable={false}
        availability={{
          resourceId: resource.id,
          date: "2099-01-05",
          timeZone: "Asia/Ho_Chi_Minh",
          status: "active",
          operatingDays: [1, 2, 3, 4, 5, 6],
          opensAt: "08:00",
          closesAt: "18:00",
          blockedReason: null,
          closureReason: null,
          requiresApproval: true,
          slots: [],
        }}
      />,
    );

    expect(screen.getByText("No bookable hourly slots remain")).toBeVisible();
    expect(screen.getByText("09:00–10:00 is no longer available.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Send booking request" }),
    ).not.toBeInTheDocument();
  });
});
