import type { Metadata } from "next";
import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up · Campus Room Booking",
};

// The sign up page. The form itself is a Client Component.
export default function SignupPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create an account</h1>
        <p className="panel-note">Sign up with your USTH email to book spaces.</p>
        <SignupForm />
      </div>
    </div>
  );
}
