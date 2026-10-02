"use client";

import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin-analytics.module.css";

interface AnalyticsRangeFormProps {
  /** Canonical range currently reflected by the report. */
  from: string;
  to: string;
}

/**
 * Date-range controls for the analytics report. Picking a valid range applies
 * it immediately (no button click); a screen-reader-only submit and the native
 * GET form keep it working for keyboard and no-JS use.
 */
export function AnalyticsRangeForm({ from, to }: AnalyticsRangeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const appliedRange = useRef({ from, to });
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fromRef.current) fromRef.current.value = from;
    if (toRef.current) toRef.current.value = to;
    appliedRange.current = { from, to };
  }, [from, to]);

  function apply() {
    const nextFrom = fromRef.current?.value ?? "";
    const nextTo = toRef.current?.value ?? "";
    // Only navigate on a complete, ordered range that differs from the current.
    if (!nextFrom || !nextTo || nextFrom > nextTo) return;
    if (nextFrom === appliedRange.current.from && nextTo === appliedRange.current.to) return;
    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    appliedRange.current = { from: nextFrom, to: nextTo };
    startTransition(() => router.push(`/admin/analytics?${params.toString()}`));
  }

  return (
    <form
      className={styles.filters}
      method="get"
      action="/admin/analytics"
      aria-busy={isPending}
    >
      <label>
        <span>From</span>
        <input
          ref={fromRef}
          type="date"
          name="from"
          defaultValue={from}
          required
          onChange={apply}
        />
      </label>
      <label>
        <span>To</span>
        <input
          ref={toRef}
          type="date"
          name="to"
          defaultValue={to}
          required
          onChange={apply}
        />
      </label>
      <span className={styles.rangeStatus} role="status" aria-live="polite">
        {isPending ? "Updating…" : ""}
      </span>
      <Link href="/admin/analytics">Last 30 campus days</Link>
      <button type="submit" className={styles.srOnly}>
        Update analytics
      </button>
    </form>
  );
}
