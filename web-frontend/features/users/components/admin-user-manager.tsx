"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin-header";
import { PaginationNav } from "@/components/pagination-nav";
import { PeopleIcon, SearchIcon, ShieldCheckIcon } from "@/components/icons";
import type { User, UserRole } from "@/features/auth/types";
import {
  createStaffAccount,
  StaffAccountError,
  updateUserStatus,
  UserMutationError,
} from "../api/browser";
import type { AdminUser, AdminUserFilters, AdminUserPage } from "../types";
import styles from "./admin-user-manager.module.css";

const roleLabels: Record<UserRole, string> = {
  student: "Student",
  staff: "Staff",
  admin: "Administrator",
};

interface PendingChange {
  user: AdminUser;
  isActive: boolean;
}

function directoryHref(filters: AdminUserFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/users${query ? `?${query}` : ""}`;
}

export function AdminUserManager({
  currentUser,
  directory,
  filters,
}: {
  currentUser: User;
  directory: AdminUserPage;
  filters: AdminUserFilters;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(directory.items);
  const [total, setTotal] = useState(directory.total);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [staffError, setStaffError] = useState<StaffAccountError | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<UserMutationError["code"] | null>(
    null,
  );
  const [result, setResult] = useState<string | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const createToggleRef = useRef<HTMLButtonElement>(null);
  const staffNameRef = useRef<HTMLInputElement>(null);

  // A refresh after creating a staff account re-renders the directory on the
  // server; adopt it so the new account appears where the server sorts it.
  const [syncedDirectory, setSyncedDirectory] = useState(directory);
  if (directory !== syncedDirectory) {
    setSyncedDirectory(directory);
    setUsers(directory.items);
    setTotal(directory.total);
  }
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);
  useEffect(() => {
    if (isCreating) staffNameRef.current?.focus();
  }, [isCreating]);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const range = useMemo(() => {
    if (total === 0) return "No accounts";
    const start = (directory.page - 1) * directory.pageSize + 1;
    const end = start + users.length - 1;
    return `${start}–${end} of ${total} accounts`;
  }, [directory.page, directory.pageSize, total, users.length]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / directory.pageSize);

  function matchesFilters(user: AdminUser): boolean {
    return (
      (!filters.role || user.role === filters.role) &&
      (!filters.status ||
        user.isActive === (filters.status === "active"))
    );
  }

  function beginStatus(user: AdminUser, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setError(null);
    setErrorCode(null);
    setResult(null);
    setPending({ user, isActive: !user.isActive });
  }

  function toggleStaffForm() {
    setStaffError(null);
    setResult(null);
    setIsCreating((open) => !open);
  }

  function cancelStaffForm() {
    if (isSavingStaff) return;
    setIsCreating(false);
    setStaffError(null);
    requestAnimationFrame(() => createToggleRef.current?.focus());
  }

  async function submitStaffAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIsSavingStaff(true);
    setStaffError(null);
    try {
      const created = await createStaffAccount({
        fullName: String(data.get("fullName") ?? ""),
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      form.reset();
      setIsCreating(false);
      setResult(
        `${created.fullName} can now sign in as staff with ${created.email}. Give them the initial password directly.`,
      );
      router.refresh();
    } catch (caught) {
      setStaffError(
        caught instanceof StaffAccountError
          ? caught
          : new StaffAccountError("unexpected", "The staff account could not be created. Try again in a moment."),
      );
    } finally {
      setIsSavingStaff(false);
    }
  }

  function closeConfirmation() {
    if (isMutating) return;
    setPending(null);
    setError(null);
    setErrorCode(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href]',
      ),
    );
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function confirmChange() {
    if (!pending) return;
    setIsMutating(true);
    setError(null);
    setErrorCode(null);
    try {
      const updated = await updateUserStatus(pending.user.id, pending.isActive);
      if (matchesFilters(updated)) {
        setUsers((current) =>
          current.map((user) => (user.id === updated.id ? updated : user)),
        );
      } else {
        setUsers((current) =>
          current.filter((user) => user.id !== updated.id),
        );
        setTotal((current) => Math.max(0, current - 1));
      }
      setResult(
        `${updated.fullName}'s account is now ${updated.isActive ? "active" : "inactive"}.`,
      );
      setPending(null);
    } catch (caught) {
      const mutationError =
        caught instanceof UserMutationError ? caught : null;
      setError(
        mutationError?.message ?? "The account could not be updated.",
      );
      setErrorCode(mutationError?.code ?? "unexpected");
      requestAnimationFrame(() => confirmRef.current?.focus());
    } finally {
      setIsMutating(false);
    }
  }

  function resetPageOnFilter(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const page = form.elements.namedItem("page");
    if (page instanceof HTMLInputElement) page.value = "1";
  }

  return (
    <main className={styles.page}>
      <AdminHeader fullName={currentUser.fullName} current="users" />

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="user-admin-title">
          <div>
            <p className={styles.context}>Campus access directory</p>
            <h1 id="user-admin-title">Put the right access in the right hands</h1>
            <p>Search USTH accounts, create staff accounts, and suspend access without deleting booking history.</p>
          </div>
          <div className={styles.accessPrinciple}>
            <ShieldCheckIcon />
            <div>
              <p><strong>Roles are set when an account is created</strong><span>Students register themselves. Staff accounts are created here. Your own access cannot be changed.</span></p>
              <button ref={createToggleRef} type="button" aria-expanded={isCreating} aria-controls="staff-account-form" onClick={toggleStaffForm}>{isCreating ? "Close staff form" : "Create staff account"}</button>
            </div>
          </div>
        </section>

        {isCreating && (
          <form id="staff-account-form" className={styles.staffForm} aria-labelledby="staff-form-title" onSubmit={(event) => void submitStaffAccount(event)}>
            <div className={styles.staffFormHeading}>
              <h2 id="staff-form-title">Create a staff account</h2>
              <p>The new staff member signs in with this USTH email and the initial password you set. Give them the password directly.</p>
            </div>
            <label><span>Full name</span><input ref={staffNameRef} name="fullName" type="text" required maxLength={120} autoComplete="off" /></label>
            <label><span>USTH email</span><input name="email" type="email" required maxLength={255} autoComplete="off" placeholder="name@usth.edu.vn" /></label>
            <div className={styles.passwordField}><label><span>Initial password</span><input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" aria-describedby="staff-password-hint" /></label><small id="staff-password-hint">At least 8 characters.</small></div>
            <div className={styles.staffFormActions}>
              <button type="button" disabled={isSavingStaff} onClick={cancelStaffForm}>Cancel</button>
              <button type="submit" disabled={isSavingStaff}>{isSavingStaff ? "Creating…" : "Create staff account"}</button>
            </div>
            {staffError && <p className={styles.error} role="alert">{staffError.message}{staffError.code === "session" && <> <Link href="/login?next=/admin/users">Sign in again</Link>.</>}</p>}
          </form>
        )}

        <form className={styles.filters} method="get" action="/admin/users" onSubmit={resetPageOnFilter}>
          <label className={styles.searchField}>
            <span>Search users</span>
            <span><SearchIcon /><input name="q" type="search" defaultValue={filters.q} maxLength={120} placeholder="Name or @usth.edu.vn email" /></span>
          </label>
          <label><span>Role</span><select name="role" defaultValue={filters.role ?? ""}><option value="">All roles</option><option value="student">Students</option><option value="staff">Staff</option><option value="admin">Administrators</option></select></label>
          <label><span>Access</span><select name="status" defaultValue={filters.status ?? ""}><option value="">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <input type="hidden" name="page" value="1" />
          <button type="submit">Search directory</button>
          {(filters.q || filters.role || filters.status) && <Link href="/admin/users">Clear filters</Link>}
        </form>

        {result && <p ref={resultRef} className={styles.result} role="status" tabIndex={-1}>{result}</p>}
        {error && !pending && <p className={styles.error} role="alert">{error}{errorCode === "session" && <> <Link href="/login?next=/admin/users">Sign in again</Link>.</>}</p>}

        <section className={styles.directory} aria-labelledby="directory-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.context}>Identity and permissions</p><h2 id="directory-title">User directory</h2></div>
            <p>{range}</p>
          </div>

          {users.length === 0 ? (
            <div className={styles.empty}><PeopleIcon /><h3>No matching accounts</h3><p>Try a broader name, email, role, or access filter.</p><Link href="/admin/users">View all users</Link></div>
          ) : (
            <div className={styles.tableWrap} role="region" aria-label="Scrollable user directory" tabIndex={0}>
              <table>
                <caption className={styles.srOnly}>USTH user accounts and access controls</caption>
                <thead><tr><th scope="col">Account</th><th scope="col">Joined</th><th scope="col">Role</th><th scope="col">Access</th></tr></thead>
                <tbody>{users.map((user) => {
                  const self = user.id === currentUser.id;
                  return <tr key={user.id} data-active={user.isActive}>
                    <td><div className={styles.account}><span aria-hidden="true">{user.fullName.slice(0, 1).toUpperCase()}</span><p><strong>{user.fullName}</strong><small>{user.email}</small>{self && <em>Current administrator</em>}</p></div></td>
                    <td><strong>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(user.createdAt))}</strong><small>Account created</small></td>
                    <td><span className={styles.role} data-role={user.role}>{roleLabels[user.role]}</span></td>
                    <td><div className={styles.access}><span data-active={user.isActive}>{user.isActive ? "Active" : "Inactive"}</span><button type="button" disabled={self || isMutating} onClick={(event) => beginStatus(user, event.currentTarget)}>{user.isActive ? "Deactivate" : "Activate"}</button></div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}

          {directory.page <= totalPages && <PaginationNav className={styles.pagination} label="User directory pages" page={directory.page} totalPages={totalPages} hrefFor={(page) => directoryHref(filters, page)} />}
        </section>
      </div>

      {pending && <div className={styles.overlay} role="presentation"><div ref={confirmRef} className={styles.confirmation} role="alertdialog" aria-modal="true" aria-labelledby="change-title" aria-describedby="change-description" tabIndex={-1} onKeyDown={handleDialogKeyDown}><p className={styles.context}>Confirm access change</p><h2 id="change-title">{`${pending.isActive ? "Activate" : "Deactivate"} this account?`}</h2><p id="change-description">{pending.isActive ? `${pending.user.fullName} will be able to sign in and use their assigned role again.` : `${pending.user.fullName} will be signed out on their next request. Their bookings and history will remain recorded.`}</p><div><button type="button" disabled={isMutating} onClick={closeConfirmation}>Keep current access</button><button type="button" disabled={isMutating} onClick={() => void confirmChange()}>{isMutating ? "Saving…" : "Confirm change"}</button></div>{error && <div className={styles.dialogRecovery}><p className={styles.error} role="alert">{error}</p>{errorCode === "session" ? <Link href="/login?next=/admin/users">Sign in again</Link> : errorCode === "validation" || errorCode === "not-found" || errorCode === "forbidden" ? <button type="button" onClick={() => router.refresh()}>Refresh user directory</button> : null}</div>}</div></div>}
    </main>
  );
}
