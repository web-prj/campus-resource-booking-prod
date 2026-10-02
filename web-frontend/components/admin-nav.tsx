import Link from "next/link";
import styles from "./admin-nav.module.css";

export type AdminSection = "resources" | "users" | "analytics";

interface AdminNavProps {
  /** The admin section currently shown, marked with aria-current. */
  current: AdminSection;
}

/**
 * Shared administrator navigation. Every admin page renders the same bar so
 * the sections, styling, and responsive behaviour stay identical.
 */
export function AdminNav({ current }: AdminNavProps) {
  return (
    <nav className={styles.adminNav} aria-label="Administrator sections">
      <Link
        href="/admin/resources"
        aria-current={current === "resources" ? "page" : undefined}
      >
        Resources
      </Link>
      <Link
        href="/admin/users"
        aria-current={current === "users" ? "page" : undefined}
      >
        Users
      </Link>
      <Link
        href="/admin/analytics"
        aria-current={current === "analytics" ? "page" : undefined}
      >
        Analytics
      </Link>
      <Link href="/staff">Approvals</Link>
    </nav>
  );
}
