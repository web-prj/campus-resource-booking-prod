"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logIn } from "@/lib/api";
import { saveCurrentUser } from "@/lib/current-user";

export default function LoginForm() {
  const router = useRouter();

  // Keep track of what the student typed.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // POST /api/auth/login with the email and password.
      const user = await logIn({ email, password });
      // Remember who is logged in, then go to the rooms page.
      saveCurrentUser(user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in.");
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="form-field">
        <label htmlFor="email">USTH email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@usth.edu.vn"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Logging in..." : "Log in"}
      </button>

      <p className="form-switch">
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </form>
  );
}
