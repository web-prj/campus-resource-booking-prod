import type { Booking, Room, User } from "./types";

// Figure out where the backend API lives.
function getBaseUrl(): string {
  // On the server (Server Components) we call the backend directly.
  if (typeof window === "undefined") {
    return process.env.INTERNAL_API_URL ?? "http://localhost:18320/api";
  }

  // In the browser we always call the same origin. next.config.ts rewrites
  // "/api/..." to the backend, so this works wherever the app is hosted
  // (localhost or the public ngrok URL) without any build-time config.
  return "/api";
}

// NestJS sends errors back as JSON like { message: "..." }, and validation
// errors as { message: ["...", "..."] }.
type ErrorBody = { message?: string | string[] };

// Little helper that calls the API and gives back JSON.
// If the response is not ok, it throws an Error with the backend's message.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    // Always get fresh data from the server (no caching).
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      // Skip the ngrok free-tier warning page so we get JSON back.
      "ngrok-skip-browser-warning": "true",
    },
    ...options,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : body?.message;
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

// Get the list of all rooms.
export function getRooms(): Promise<Room[]> {
  return request<Room[]>("/resources");
}

// Get a single room by its id.
export function getRoom(id: string): Promise<Room> {
  return request<Room>(`/resources/${id}`);
}

// Get all bookings of one user (newest first).
// The user id goes in the URL: GET /api/bookings?userId=...
export function getBookings(userId: string): Promise<Booking[]> {
  return request<Booking[]>(`/bookings?userId=${encodeURIComponent(userId)}`);
}

// The data we send when making a new booking.
export type CreateBookingInput = {
  userId: string; // who is booking
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
};

// Make a new booking.
export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return request<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// The data we send when signing up.
export type SignUpInput = {
  fullName: string;
  email: string;
  password: string;
};

// Create a new account. The backend saves it and sends back the new user.
export function signUp(input: SignUpInput): Promise<User> {
  return request<User>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// The data we send when logging in.
export type LogInInput = {
  email: string;
  password: string;
};

// Log in. The backend checks the password and sends back the user.
export function logIn(input: LogInInput): Promise<User> {
  return request<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Cancel a booking by its id. We send the user id so the backend can check
// that the booking belongs to this user.
export function cancelBooking(id: string, userId: string): Promise<Booking> {
  return request<Booking>(`/bookings/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ userId }),
  });
}
