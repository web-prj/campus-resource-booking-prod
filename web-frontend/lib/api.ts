import type { Booking, Room } from "./types";

// Figure out where the backend API lives.
// In the browser we use the public URL. On the server (Server Components)
// we prefer INTERNAL_API_URL if it is set, otherwise the public URL.
function getBaseUrl(): string {
  const publicUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18320/api";

  // typeof window === "undefined" means we are running on the server.
  if (typeof window === "undefined" && process.env.INTERNAL_API_URL) {
    return process.env.INTERNAL_API_URL;
  }

  return publicUrl;
}

// Little helper that calls the API and gives back JSON.
// It throws a simple Error if the response is not ok.
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    // Always get fresh data from the server (no caching).
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
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

// Get all of the student's bookings (newest first).
export function getBookings(): Promise<Booking[]> {
  return request<Booking[]>("/bookings");
}

// The data we send when making a new booking.
export type CreateBookingInput = {
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

// Cancel a booking by its id.
export function cancelBooking(id: string): Promise<Booking> {
  return request<Booking>(`/bookings/${id}/cancel`, {
    method: "PATCH",
  });
}
