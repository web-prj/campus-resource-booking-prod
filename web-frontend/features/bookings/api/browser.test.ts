import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingRequestError,
  cancelStudentBooking,
  createBookingRequest,
} from "./browser";

const input = {
  resourceId: "20000000-0000-4000-8000-000000000001",
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
};
const result = {
  id: "40000000-0000-4000-8000-000000000001",
  ...input,
  timeZone: "Asia/Ho_Chi_Minh",
  status: "confirmed",
  createdAt: "2026-09-15T00:00:00.000Z",
};

function response(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("booking request browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:18320/api/");
  });

  it("posts the scoped interval without credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response(result));

    await expect(
      createBookingRequest(input, request),
    ).resolves.toEqual(result);
    expect(request).toHaveBeenCalledWith(
      "http://localhost:18320/api/bookings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    const [, requestInit] = request.mock.calls[0];
    expect(requestInit).not.toHaveProperty("credentials");
  });

  it.each([
    [400, "validation"],
    [401, "session"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [429, "rate-limit"],
    [500, "unexpected"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({}, status));

    await expect(
      createBookingRequest(input, request),
    ).rejects.toMatchObject({ code } satisfies Partial<BookingRequestError>);
  });

  it("maps network errors and rejects out-of-scope success data", async () => {
    await expect(
      createBookingRequest(
        input,
        vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
      ),
    ).rejects.toMatchObject({ code: "network" });

    await expect(
      createBookingRequest(
        input,
        vi.fn<typeof fetch>().mockResolvedValue(
          response({ ...result, resourceId: "20000000-0000-4000-8000-000000000002" }),
        ),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });
});

const bookingId = "50000000-0000-4000-8000-000000000001";
const resource = {
  id: "20000000-0000-4000-8000-000000000001",
  code: "ROOM-A101",
  name: "Study Room A101",
  type: "room",
  location: "First floor",
  buildingCode: "MAIN",
  buildingName: "Main Academic Building",
};
const baseBooking = {
  id: bookingId,
  date: "2099-01-05",
  startTime: "09:00",
  endTime: "10:00",
  timeZone: "Asia/Ho_Chi_Minh",
  canCancel: false,
  hasEnded: false,
  cancelledAt: null,
  createdAt: "2026-09-15T00:00:00.000Z",
  resource,
};

describe("student cancellation browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:18320/api/");
  });

  const cancelled = {
    ...baseBooking,
    status: "cancelled",
    cancelledAt: "2026-09-16T01:00:00.000Z",
  };

  it("patches the cancel endpoint and returns the cancelled booking", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(cancelled, 200));

    await expect(
      cancelStudentBooking(bookingId, request),
    ).resolves.toEqual(cancelled);
    expect(request).toHaveBeenCalledWith(
      `http://localhost:18320/api/bookings/mine/${bookingId}/cancel`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("rejects a response that is not cancelled", async () => {
    await expect(
      cancelStudentBooking(
        bookingId,
        vi.fn<typeof fetch>().mockResolvedValue(
          response({ ...baseBooking, status: "confirmed", canCancel: true }, 200),
        ),
      ),
    ).rejects.toMatchObject({ code: "unexpected" });
  });
});
