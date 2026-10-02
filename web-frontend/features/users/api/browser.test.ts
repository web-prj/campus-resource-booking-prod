import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffAccount, updateUserStatus } from "./browser";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "nam.tran@usth.edu.vn",
  fullName: "Nam Tran",
  role: "student",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("admin user browser API", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:18320/api/");
  });

  it("updates account access with credentialed strict response validation", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ ...user, isActive: false }));
    await expect(updateUserStatus(user.id, false, request)).resolves.toMatchObject({ isActive: false });
    expect(request).toHaveBeenCalledWith(
      `http://localhost:18320/api/admin/users/${user.id}/status`,
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ isActive: false }),
      }),
    );
  });

  it.each([[400, "validation"], [401, "session"], [403, "forbidden"], [404, "not-found"]] as const)(
    "maps HTTP %i to %s",
    async (status, code) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response({}, status));
      await expect(updateUserStatus(user.id, false, request)).rejects.toMatchObject({ code });
    },
  );

  it("rejects a successful response for a different account", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response({ ...user, id: "22222222-2222-4222-8222-222222222222", isActive: false }));
    await expect(updateUserStatus(user.id, false, request)).rejects.toMatchObject({ code: "unexpected" });
  });

  describe("createStaffAccount", () => {
    const staff = { ...user, email: "lan.pham@usth.edu.vn", fullName: "Lan Pham", role: "staff" };
    const details = { fullName: "  Lan Pham ", email: " Lan.Pham@USTH.edu.vn ", password: "initial-pass" };

    it("posts normalized details with credentials and returns the staff account", async () => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response(staff, 201));
      await expect(createStaffAccount(details, request)).resolves.toMatchObject({ role: "staff", email: "lan.pham@usth.edu.vn" });
      expect(request).toHaveBeenCalledWith(
        "http://localhost:18320/api/admin/users",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ email: "lan.pham@usth.edu.vn", password: "initial-pass", fullName: "Lan Pham" }),
        }),
      );
    });

    it.each([[400, "validation"], [401, "session"], [403, "forbidden"], [409, "duplicate"], [500, "unexpected"]] as const)(
      "maps HTTP %i to %s",
      async (status, code) => {
        const request = vi.fn<typeof fetch>().mockResolvedValue(response({}, status));
        await expect(createStaffAccount(details, request)).rejects.toMatchObject({ code });
      },
    );

    it("maps an unreachable service to network", async () => {
      const request = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
      await expect(createStaffAccount(details, request)).rejects.toMatchObject({ code: "network" });
    });

    it("rejects a created account that is not the requested staff member", async () => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(response({ ...staff, role: "student" }, 201));
      await expect(createStaffAccount(details, request)).rejects.toMatchObject({ code: "unexpected" });
    });
  });
});
