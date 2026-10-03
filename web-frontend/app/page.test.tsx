import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";
import { getResourceDirectory } from "@/features/resources/api/server";
import { redirect } from "next/navigation";

vi.mock("@/features/resources/api/server", () => ({
  getResourceDirectory: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const buildings = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    code: "MAIN",
    name: "Main Academic Building",
    address: "USTH Campus, Hanoi",
  },
];

function directory(page = 1, totalPages = 1) {
  return {
    page: {
      items: [],
      total: totalPages,
      page,
      pageSize: 9,
      totalPages,
    },
    buildings,
  };
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.mocked(getResourceDirectory).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("opens directly on the room directory without any authentication guard", async () => {
    vi.mocked(getResourceDirectory).mockResolvedValue(directory());

    const page = await HomePage({
      searchParams: Promise.resolve({
        q: "  study room  ",
        amenity: " HDMI-Cable ",
        unknown: "ignored",
      }),
    });

    const filters = {
      q: "study room",
      amenity: "hdmi-cable",
    };
    expect(getResourceDirectory).toHaveBeenCalledWith(filters);
    expect(page.props).toEqual({ filters, ...directory() });
  });

  it("redirects an out-of-range page to the last authoritative page while preserving filters", async () => {
    vi.mocked(getResourceDirectory).mockResolvedValue(directory(99, 2));

    await expect(
      HomePage({
        searchParams: Promise.resolve({
          q: "study room",
          sort: "capacity_desc",
          page: "99",
        }),
      }),
    ).rejects.toThrow(
      "redirect:/resources?q=study+room&sort=capacity_desc&page=2",
    );
  });
});
