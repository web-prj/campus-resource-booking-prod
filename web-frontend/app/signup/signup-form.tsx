"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signUp } from "@/lib/api";
import { saveCurrentUser } from "@/lib/current-user";

export default function SignupForm() {
  const router = useRouter();

  // Keep track of what the student typed.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // POST /api/auth/signup. The backend saves the new account.
      const user = await signUp({ fullName, email, password });
      // Log the new student in straight away, then go to the rooms page.
      saveCurrentUser(user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up.");
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
        <label htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>

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
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          aria-describedby="password-hint"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p id="password-hint" className="field-hint">
          At least 8 characters.
        </p>
      </div>

      <button type="submit" className="button-primary" disabled={submitting}>
        {submitting ? "Creating account..." : "Create account"}
      </button>

      <p className="form-switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}
