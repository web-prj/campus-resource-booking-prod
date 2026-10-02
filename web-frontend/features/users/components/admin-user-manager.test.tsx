import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStaffAccount,
  StaffAccountError,
  updateUserStatus,
  UserMutationError,
} from "../api/browser";
import type { AdminUser } from "../types";
import { AdminUserManager } from "./admin-user-manager";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../api/browser", () => ({
  createStaffAccount: vi.fn(),
  updateUserStatus: vi.fn(),
  UserMutationError: class UserMutationError extends Error {
    constructor(public readonly code: string, message: string) { super(message); }
  },
  StaffAccountError: class StaffAccountError extends Error {
    constructor(public readonly code: string, message: string) { super(message); }
  },
}));

const currentUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "admin@usth.edu.vn",
  fullName: "Campus Admin",
  role: "admin" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const adminUser: AdminUser = {
  ...currentUser,
  isActive: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const student: AdminUser = {
  id: "20000000-0000-4000-8000-000000000002",
  email: "student@usth.edu.vn",
  fullName: "Directory Student",
  role: "student",
  isActive: true,
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

function renderManager(
  items = [adminUser, student],
  filters: import("../types").AdminUserFilters = { page: 1 },
) {
  return render(
    <AdminUserManager
      currentUser={currentUser}
      directory={{
        items,
        total: items.length,
        page: 1,
        pageSize: 20,
        totalPages: items.length ? 1 : 0,
      }}
      filters={filters}
    />,
  );
}

describe("AdminUserManager", () => {
  beforeEach(() => {
    vi.mocked(createStaffAccount).mockReset();
    vi.mocked(updateUserStatus).mockReset();
    refresh.mockReset();
  });

  it("shows roles read-only and protects the current administrator", () => {
    renderManager();
    expect(screen.getByRole("heading", { name: "Put the right access in the right hands" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Administrator sections" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: /Role for/ })).not.toBeInTheDocument();
    const selfRow = screen.getByText("admin@usth.edu.vn").closest("tr")!;
    expect(within(selfRow).getByText("Administrator")).toBeVisible();
    expect(within(selfRow).getByRole("button", { name: "Deactivate" })).toBeDisabled();
    const studentRow = screen.getByText("student@usth.edu.vn").closest("tr")!;
    expect(within(studentRow).getByText("Student")).toBeVisible();
  });

  it("creates a staff account, announces it, and refreshes the directory", async () => {
    vi.mocked(createStaffAccount).mockResolvedValue({
      ...student,
      id: "30000000-0000-4000-8000-000000000003",
      email: "lan.pham@usth.edu.vn",
      fullName: "Lan Pham",
      role: "staff",
    });
    renderManager();
    const toggle = screen.getByRole("button", { name: "Create staff account" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const form = screen.getByRole("form", { name: "Create a staff account" });
    expect(within(form).getByLabelText("Full name")).toHaveFocus();
    await userEvent.type(within(form).getByLabelText("Full name"), "Lan Pham");
    await userEvent.type(within(form).getByLabelText("USTH email"), "lan.pham@usth.edu.vn");
    await userEvent.type(within(form).getByLabelText("Initial password"), "initial-pass");
    await userEvent.click(within(form).getByRole("button", { name: "Create staff account" }));

    expect(createStaffAccount).toHaveBeenCalledWith({
      fullName: "Lan Pham",
      email: "lan.pham@usth.edu.vn",
      password: "initial-pass",
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent("Lan Pham can now sign in as staff");
    expect(screen.queryByRole("form", { name: "Create a staff account" })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows the refreshed directory the server sends after a change", () => {
    const view = renderManager([adminUser]);
    expect(screen.queryByText("student@usth.edu.vn")).not.toBeInTheDocument();
    view.rerender(
      <AdminUserManager
        currentUser={currentUser}
        directory={{ items: [adminUser, student], total: 2, page: 1, pageSize: 20, totalPages: 1 }}
        filters={{ page: 1 }}
      />,
    );
    expect(screen.getByText("student@usth.edu.vn")).toBeVisible();
    expect(screen.getByText("1–2 of 2 accounts")).toBeVisible();
  });

  it("keeps the staff form open with the reason when creation fails", async () => {
    vi.mocked(createStaffAccount).mockRejectedValue(
      new StaffAccountError("duplicate", "An account already exists for this USTH email. Find it in the directory instead."),
    );
    renderManager();
    await userEvent.click(screen.getByRole("button", { name: "Create staff account" }));
    const form = screen.getByRole("form", { name: "Create a staff account" });
    await userEvent.type(within(form).getByLabelText("Full name"), "Directory Student");
    await userEvent.type(within(form).getByLabelText("USTH email"), "student@usth.edu.vn");
    await userEvent.type(within(form).getByLabelText("Initial password"), "initial-pass");
    await userEvent.click(within(form).getByRole("button", { name: "Create staff account" }));

    expect(await within(form).findByRole("alert")).toHaveTextContent("already exists");
    expect(within(form).getByLabelText("USTH email")).toHaveValue("student@usth.edu.vn");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns focus to the toggle when the staff form is cancelled", async () => {
    renderManager();
    const toggle = screen.getByRole("button", { name: "Create staff account" });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Create a staff account" })).not.toBeInTheDocument();
    await waitFor(() => expect(toggle).toHaveFocus());
  });

  it("restores the initiating control when a change is cancelled", async () => {
    renderManager();
    const deactivate = screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!;
    await userEvent.click(deactivate);
    expect(screen.getByRole("alertdialog")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(deactivate).toHaveFocus());
  });

  it("traps keyboard focus inside the confirmation dialog", async () => {
    renderManager();
    await userEvent.click(screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!);
    const keep = screen.getByRole("button", { name: "Keep current access" });
    const confirm = screen.getByRole("button", { name: "Confirm change" });
    confirm.focus();
    await userEvent.tab();
    expect(keep).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(confirm).toHaveFocus();
  });

  it("keeps failures in the dialog with explicit recovery", async () => {
    vi.mocked(updateUserStatus).mockRejectedValue(
      new UserMutationError(
        "not-found",
        "This account no longer exists. Refresh the directory.",
      ),
    );
    renderManager();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!,
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This account no longer exists",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Refresh user directory" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("offers a safe sign-in destination when the session expires", async () => {
    vi.mocked(updateUserStatus).mockRejectedValue(
      new UserMutationError(
        "session",
        "Your session has ended. Sign in again to manage users.",
      ),
    );
    renderManager();
    await userEvent.click(screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!);
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(await screen.findByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/login?next=/admin/users",
    );
  });

  it("explains deactivation and records the inactive state", async () => {
    vi.mocked(updateUserStatus).mockResolvedValue({ ...student, isActive: false });
    renderManager();
    await userEvent.click(screen.getAllByRole("button", { name: "Deactivate" }).at(-1)!);
    expect(screen.getByText(/signed out on their next request/i)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));
    const studentRow = screen.getByText("student@usth.edu.vn").closest("tr")!;
    expect(within(studentRow).getByText("Inactive")).toBeVisible();
    expect(updateUserStatus).toHaveBeenCalledWith(student.id, false);
  });

  it("removes a successful mutation from a filtered view", async () => {
    vi.mocked(updateUserStatus).mockResolvedValue({
      ...student,
      isActive: false,
    });
    renderManager([student], { page: 1, status: "active" });

    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    expect(
      await screen.findByRole("heading", { name: "No matching accounts" }),
    ).toBeVisible();
    expect(screen.getByText("No accounts")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("provides an actionable empty state", () => {
    renderManager([]);
    expect(screen.getByRole("heading", { name: "No matching accounts" })).toBeVisible();
    expect(screen.getByRole("link", { name: "View all users" })).toHaveAttribute("href", "/admin/users");
  });

  it("links to staff approvals from the administrator navigation", () => {
    renderManager();
    const nav = screen.getByRole("navigation", { name: "Administrator sections" });
    expect(within(nav).getByRole("link", { name: "Approvals" })).toHaveAttribute("href", "/staff");
    expect(within(nav).getByRole("link", { name: "Users" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Approvals" })).not.toHaveAttribute("aria-current");
  });

  it("paginates the directory with filters preserved and disabled ends", () => {
    render(
      <AdminUserManager
        currentUser={currentUser}
        directory={{ items: [student], total: 21, page: 2, pageSize: 20, totalPages: 2 }}
        filters={{ page: 2, role: "student" }}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "User directory pages" });
    expect(nav).toHaveTextContent("Page 2 of 2");
    expect(within(nav).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/admin/users?role=student",
    );
    expect(within(nav).getByText("Next")).toHaveAttribute("aria-disabled", "true");
  });
});
