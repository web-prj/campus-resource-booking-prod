export type BookingStatus = "confirmed" | "cancelled";

export interface BookingResourceSummary {
  id: string;
  code: string;
  name: string;
  type: "room";
  location: string;
  buildingCode: string;
  buildingName: string;
}

export interface StudentBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: "Asia/Ho_Chi_Minh";
  status: BookingStatus;
  canCancel: boolean;
  hasEnded: boolean;
  cancelledAt: string | null;
  createdAt: string;
  resource: BookingResourceSummary;
}

export interface StudentBookingTimeline {
  upcoming: StudentBooking[];
  history: StudentBooking[];
}

export interface BookingRequestInput {
  resourceId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface BookingRequestResult extends BookingRequestInput {
  id: string;
  timeZone: "Asia/Ho_Chi_Minh";
  status: "confirmed";
  createdAt: string;
}
