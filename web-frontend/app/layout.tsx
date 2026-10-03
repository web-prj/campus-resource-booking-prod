import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import UserMenu from "@/components/user-menu";
import "./globals.css";

// Two deliberate typefaces: Space Grotesk for headings and room codes
// (a technical, wayfinding feel), Inter for comfortable body text.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

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
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <header className="site-header">
          <nav className="nav" aria-label="Main">
            <Link href="/" className="site-title">
              <svg
                className="site-mark"
                viewBox="0 0 64 64"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M13 27 32 15l19 12-3 5-16-10-16 10-3-5Z" fill="#EC2227" />
                <path d="M16 27 32 17l16 10v22H16V27Z" fill="#fff" />
                <path d="M26 33h12v16H26z" fill="#2A3C95" />
              </svg>
              <span>Campus Room Booking</span>
            </Link>
            <ul className="nav-links">
              <li>
                <Link href="/">Rooms</Link>
              </li>
              <li>
                <Link href="/bookings">My Bookings</Link>
              </li>
              <UserMenu />
            </ul>
          </nav>
        </header>
        <main className="main">{children}</main>
        <footer className="site-footer">
          <p>USTH Campus Resource Booking</p>
        </footer>
      </body>
    </html>
  );
}
