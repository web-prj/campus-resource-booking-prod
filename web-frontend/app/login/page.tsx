import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Log in · Campus Room Booking",
};

// The log in page. The form itself is a Client Component.
export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Log in</h1>
        <p className="panel-note">Welcome back. Use your USTH email address.</p>
        <LoginForm />
      </div>
    </div>
  );
}
