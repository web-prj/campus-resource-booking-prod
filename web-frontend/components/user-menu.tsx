"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCurrentUser, useCurrentUser } from "@/lib/current-user";

// The right side of the header: "Log in / Sign up" when logged out,
// or the student's name and a "Log out" button when logged in.
export default function UserMenu() {
  const router = useRouter();
  const user = useCurrentUser();

  function handleLogOut() {
    clearCurrentUser();
    router.push("/");
  }

  // Still checking who is logged in: show nothing rather than the wrong links.
  if (user === undefined) {
    return null;
  }

  if (!user) {
    return (
      <>
        <li>
          <Link href="/login">Log in</Link>
        </li>
        <li>
          <Link href="/signup" className="nav-cta">
            Sign up
          </Link>
        </li>
      </>
    );
  }

  return (
    <>
      <li className="nav-user" title={user.email}>
        Hi, {user.fullName}
      </li>
      <li>
        <button type="button" className="nav-button" onClick={handleLogOut}>
          Log out
        </button>
      </li>
    </>
  );
}
