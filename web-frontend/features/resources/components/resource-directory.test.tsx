import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Building, Resource, ResourcePage } from "../types";
import { ResourceDirectory } from "./resource-directory";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const building: Building = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "MAIN",
  name: "Main Academic Building",
  address: "USTH Campus, Hanoi",
};

const room: Resource = {
  id: "20000000-0000-4000-8000-000000000001",
  code: "ROOM-A101",
  name: "Study Room A101",
  description: "A group study room.",
  type: "room",
  status: "active",
  capacity: 8,
  location: "First floor",
  amenities: ["whiteboard", "display", "power outlets", "air conditioning"],
  requiresApproval: false,
  operatingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00",
  closesAt: "18:00",
  building,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const seminar: Resource = {
  ...room,
  id: "20000000-0000-4000-8000-000000000003",
  code: "ROOM-B204",
  name: "Seminar Room B204",
  type: "room",
  capacity: 24,
  location: "Second floor",
  amenities: ["projector screen", "microphone"],
  requiresApproval: true,
};

function page(overrides: Partial<ResourcePage> = {}): ResourcePage {
  return {
    items: [room, seminar],
    total: 10,
    page: 2,
    pageSize: 9,
    totalPages: 3,
    ...overrides,
  };
}

describe("ResourceDirectory", () => {
  it("renders live campus room facts and populated filters", () => {
    render(
      <ResourceDirectory
        page={page()}
        buildings={[building]}
        filters={{
          q: "study",
          buildingId: building.id,
          minCapacity: 8,
          amenity: "whiteboard",
          sort: "capacity_desc",
          page: 2,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Find the right room on campus.",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Room or location")).toHaveValue("study");
    expect(screen.getByLabelText("Building")).toHaveValue(building.id);
    expect(screen.getByLabelText("Minimum capacity")).toHaveValue(8);
    expect(screen.getByLabelText("Amenity")).toHaveValue("whiteboard");
    expect(screen.getByLabelText("Sort results")).toHaveValue("capacity_desc");
    expect(
      screen.getByRole("link", { name: "Clear 4 filters" }),
    ).toHaveAttribute("href", "/resources");
    expect(
      screen.getByRole("navigation", { name: "Resource navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "My bookings" })).toHaveAttribute(
      "href",
      "/bookings",
    );

    const roomCard = screen.getByText("Study Room A101").closest("article")!;
    expect(within(roomCard).getByText("8")).toBeVisible();
    expect(within(roomCard).getByText("places")).toBeVisible();
    expect(
      within(roomCard).getByText("No staff approval required"),
    ).toBeVisible();
    expect(within(roomCard).getByText("+1 more")).toBeVisible();
    expect(
      within(roomCard).getByRole("link", { name: "View resource details" }),
    ).toHaveAttribute("href", `/resources/${room.id}`);

    const seminarCard = screen
      .getByText("Seminar Room B204")
      .closest("article")!;
    expect(within(seminarCard).getByText("Staff approval")).toBeVisible();
  });

  it("accepts a date with both times set to Any, but requires paired interval times", () => {
    render(
      <ResourceDirectory
        page={page()}
        buildings={[building]}
        filters={{}}
      />,
    );

    const date = screen.getByLabelText("Operational date");
    const start = screen.getByLabelText("From");
    const end = screen.getByLabelText("Until");

    // The campus booking window is 08:00–18:00, so times outside it are absent.
    expect(within(start).queryByRole("option", { name: "07:00" })).toBeNull();
    expect(within(start).queryByRole("option", { name: "18:00" })).toBeNull();
    expect(within(end).queryByRole("option", { name: "08:00" })).toBeNull();
    expect(within(end).queryByRole("option", { name: "19:00" })).toBeNull();
    expect(
      within(start).getByRole("option", { name: "08:00" }),
    ).toBeInTheDocument();
    expect(
      within(end).getByRole("option", { name: "18:00" }),
    ).toBeInTheDocument();

    fireEvent.change(date, { target: { value: "2026-09-15" } });
    expect(date).not.toBeRequired();
    expect(start).not.toBeRequired();
    expect(end).not.toBeRequired();
    expect(start).not.toHaveAttribute("name");
    expect(end).not.toHaveAttribute("name");

    fireEvent.change(start, { target: { value: "16:00" } });
    expect(date).toBeRequired();
    expect(end).toBeRequired();
    expect(start).toHaveAttribute("name", "startTime");
    fireEvent.change(end, { target: { value: "15:00" } });
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect((end as HTMLSelectElement).validationMessage).toBe(
      "Until must be after From.",
    );

    fireEvent.change(end, { target: { value: "17:00" } });
    expect(end).not.toHaveAttribute("aria-invalid");
    expect((end as HTMLSelectElement).validationMessage).toBe("");

    fireEvent.change(start, { target: { value: "" } });
    expect(start).toBeRequired();
    expect(date).toBeRequired();
    fireEvent.change(end, { target: { value: "" } });
    expect(start).not.toBeRequired();
    expect(date).not.toBeRequired();
  });

  it("links date-only results to the full-day slot schedule", () => {
    render(
      <ResourceDirectory
        page={page({ page: 1 })}
        buildings={[building]}
        filters={{ date: "2099-01-05" }}
      />,
    );

    expect(screen.getByLabelText("Operational date")).toHaveValue("2099-01-05");
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.getByLabelText("Until")).toHaveValue("");
    expect(screen.getByRole("link", { name: "Clear 1 filter" })).toBeVisible();
    const roomCard = screen.getByText("Study Room A101").closest("article")!;
    expect(
      within(roomCard).getByRole("link", { name: "View resource details" }),
    ).toHaveAttribute("href", `/resources/${room.id}?date=2099-01-05`);
  });

  it("resets interval controls when normalized URL filters change", () => {
    const view = render(
      <ResourceDirectory
        page={page()}
        buildings={[building]}
        filters={{
          date: "2026-09-15",
          startTime: "09:00",
          endTime: "11:00",
        }}
      />,
    );

    expect(screen.getByLabelText("Operational date")).toHaveValue(
      "2026-09-15",
    );
    expect(screen.getByLabelText("From")).toHaveValue("09:00");
    expect(screen.getByLabelText("Until")).toHaveValue("11:00");

    view.rerender(
      <ResourceDirectory
        page={page()}
        buildings={[building]}
        filters={{}}
      />,
    );

    expect(screen.getByLabelText("Operational date")).toHaveValue("");
    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.getByLabelText("Until")).toHaveValue("");
  });

  it("suggests a narrower time search when no resources are free all day", () => {
    render(
      <ResourceDirectory
        page={page({ items: [], total: 0, page: 1, totalPages: 0 })}
        buildings={[building]}
        filters={{ date: "2099-01-05" }}
      />,
    );
    expect(screen.getByText(/select a shorter interval/i)).toBeVisible();
  });

  it("preserves a complete interval in resource detail links", () => {
    render(
      <ResourceDirectory
        page={page({ page: 1 })}
        buildings={[building]}
        filters={{
          date: "2099-01-05",
          startTime: "09:00",
          endTime: "11:00",
        }}
      />,
    );

    const roomCard = screen.getByText("Study Room A101").closest("article")!;
    expect(
      within(roomCard).getByRole("link", { name: "View resource details" }),
    ).toHaveAttribute(
      "href",
      `/resources/${room.id}?date=2099-01-05&startTime=09%3A00&endTime=11%3A00`,
    );
  });

  it("remounts all URL-backed controls from canonical filters", () => {
    const view = render(
      <ResourceDirectory
        page={page()}
        buildings={[building]}
        filters={{ q: "room", minCapacity: 8 }}
      />,
    );
    const search = screen.getByLabelText("Room or location");
    fireEvent.change(search, { target: { value: "dirty value" } });

    view.rerender(
      <ResourceDirectory
        page={page()}
        buildings={[building]}
        filters={{ q: "seminar", minCapacity: 20 }}
      />,
    );

    expect(screen.getByLabelText("Room or location")).toHaveValue("seminar");
    expect(screen.getByLabelText("Minimum capacity")).toHaveValue(20);
  });

  it("preserves filters in pagination links", () => {
    render(
      <ResourceDirectory
        page={page()}
        buildings={[building]}
        filters={{ q: "room", sort: "capacity_asc", page: 2 }}
      />,
    );

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/resources?q=room&sort=capacity_asc",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/resources?q=room&sort=capacity_asc&page=3",
    );
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("gives useful direction when no resources match", () => {
    render(
      <ResourceDirectory
        page={page({ items: [], total: 0, page: 1, totalPages: 0 })}
        buildings={[building]}
        filters={{ amenity: "microscope" }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "No active resources match these filters",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "View all resources" }),
    ).toHaveAttribute("href", "/resources");
    expect(
      screen.queryByRole("navigation", { name: "Resource pages" }),
    ).not.toBeInTheDocument();
  });
});
