// These are the shapes of the data we get back from the backend API.

// A bookable thing: a room, a lab, or a piece of equipment.
export type Room = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: "room" | "lab" | "equipment";
  capacity: number;
  location: string;
  amenities: string[];
  building: {
    id: string;
    code: string;
    name: string;
  };
};

// A student account, as returned by sign up and log in (never a password).
export type User = {
  id: string;
  email: string;
  fullName: string;
};

// A booking that the student made for a room.
export type Booking = {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  status: "confirmed" | "cancelled";
  cancelledAt: string | null;
  createdAt: string;
  resource: {
    id: string;
    code: string;
    name: string;
    location: string;
    building: {
      name: string;
    };
  };
};
