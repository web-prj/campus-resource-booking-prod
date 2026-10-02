import { ApiError, browserRequest } from "@/lib/api/browser-client";
import { parseAdminUser } from "../schema";
import type { AdminUser } from "../types";

export type UserMutationErrorCode =
  | "validation"
  | "session"
  | "forbidden"
  | "not-found"
  | "network"
  | "unexpected";

export class UserMutationError extends Error {
  constructor(
    public readonly code: UserMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UserMutationError";
  }
}

function mutationError(error: unknown): UserMutationError {
  if (error instanceof UserMutationError) return error;
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return new UserMutationError("network", "The user service is unreachable. Check your connection and try again.");
    }
    if (error.status === 400) {
      return new UserMutationError("validation", "This account change is not allowed. Refresh the directory and try again.");
    }
    if (error.status === 401) {
      return new UserMutationError("session", "Your session has ended. Sign in again to manage users.");
    }
    if (error.status === 403) {
      return new UserMutationError("forbidden", "Your account does not have permission to manage users.");
    }
    if (error.status === 404) {
      return new UserMutationError("not-found", "This account no longer exists. Refresh the directory.");
    }
  }
  return new UserMutationError("unexpected", "The account could not be updated. Try again in a moment.");
}

async function mutateUser(
  id: string,
  path: string,
  body: object,
  validate: (user: AdminUser) => boolean,
  request: typeof fetch,
): Promise<AdminUser> {
  try {
    const user = parseAdminUser(
      await browserRequest(`/admin/users/${id}/${path}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }, request),
    );
    if (!user || user.id !== id || !validate(user)) {
      throw new UserMutationError("unexpected", "The user service returned invalid account data.");
    }
    return user;
  } catch (error) {
    throw mutationError(error);
  }
}

export function updateUserStatus(
  id: string,
  isActive: boolean,
  request: typeof fetch = fetch,
): Promise<AdminUser> {
  return mutateUser(id, "status", { isActive }, (user) => user.isActive === isActive, request);
}

export interface StaffAccountDetails {
  fullName: string;
  email: string;
  password: string;
}

export type StaffAccountErrorCode =
  | "validation"
  | "duplicate"
  | "session"
  | "forbidden"
  | "network"
  | "unexpected";

export class StaffAccountError extends Error {
  constructor(
    public readonly code: StaffAccountErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StaffAccountError";
  }
}

const staffAccountMessages: Record<StaffAccountErrorCode, string> = {
  validation: "Check the name, the @usth.edu.vn email, and that the password has 8 to 72 characters.",
  duplicate: "An account already exists for this USTH email. Find it in the directory instead.",
  session: "Your session has ended. Sign in again to create staff accounts.",
  forbidden: "Your account does not have permission to create staff accounts.",
  network: "The user service is unreachable. Check your connection and try again.",
  unexpected: "The staff account could not be created. Try again in a moment.",
};

function staffAccountCodeFor(error: ApiError): StaffAccountErrorCode {
  if (error.kind === "network") return "network";
  if (error.status === 400) return "validation";
  if (error.status === 401) return "session";
  if (error.status === 403) return "forbidden";
  if (error.status === 409) return "duplicate";
  return "unexpected";
}

export async function createStaffAccount(
  details: StaffAccountDetails,
  request: typeof fetch = fetch,
): Promise<AdminUser> {
  const email = details.email.trim().toLowerCase();
  try {
    const user = parseAdminUser(
      await browserRequest(
        "/admin/users",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password: details.password,
            fullName: details.fullName.trim(),
          }),
        },
        request,
      ),
    );
    if (!user || user.role !== "staff" || user.email !== email) {
      throw new StaffAccountError("unexpected", "The user service returned invalid account data.");
    }
    return user;
  } catch (error) {
    if (error instanceof StaffAccountError) throw error;
    const code = error instanceof ApiError ? staffAccountCodeFor(error) : "unexpected";
    throw new StaffAccountError(code, staffAccountMessages[code]);
  }
}
