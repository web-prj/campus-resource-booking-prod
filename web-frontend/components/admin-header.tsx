import { AdminNav, type AdminSection } from "@/components/admin-nav";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/features/auth/components/logout-button";
import styles from "./admin-header.module.css";

interface AdminHeaderProps {
  /** Signed-in administrator's display name. */
  fullName: string;
  /** The admin section currently shown, marked active in the nav. */
  current: AdminSection;
}

/**
 * Shared administrator header. Every /admin page renders this so the brand,
 * navigation, identity, and responsive behaviour are identical across pages.
 */
export function AdminHeader({ fullName, current }: AdminHeaderProps) {
  return (
    <header className={styles.header}>
      <BrandMark />
      <AdminNav current={current} />
      <div className={styles.identity}>
        <span>
          <strong>{fullName}</strong>
          <small>Administrator</small>
        </span>
        <LogoutButton
          className={styles.logout}
          errorClassName={styles.logoutError}
        />
      </div>
    </header>
  );
}
