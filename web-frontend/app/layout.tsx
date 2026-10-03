import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Room Booking",
  description: "Book USTH campus rooms, labs, and equipment.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="nav" aria-label="Main">
            <Link href="/" className="site-title">
              Campus Room Booking
            </Link>
            <ul className="nav-links">
              <li>
                <Link href="/">Rooms</Link>
              </li>
              <li>
                <Link href="/bookings">My Bookings</Link>
              </li>
            </ul>
          </nav>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
