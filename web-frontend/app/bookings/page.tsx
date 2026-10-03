import { getBookings } from "@/lib/api";
import CancelButton from "./cancel-button";

// Show all of the student's bookings. This is a Server Component.
export default async function BookingsPage() {
  const bookings = await getBookings();

  return (
    <div>
      <h1>My Bookings</h1>

      {bookings.length === 0 ? (
        <p>You have no bookings yet.</p>
      ) : (
        <ul className="booking-list">
          {bookings.map((booking) => (
            <li key={booking.id} className="booking-card">
              <h2>{booking.resource.name}</h2>
              <dl>
                <dt>Building</dt>
                <dd>{booking.resource.building.name}</dd>
                <dt>Date</dt>
                <dd>{booking.date}</dd>
                <dt>Time</dt>
                <dd>
                  {booking.startTime}&ndash;{booking.endTime}
                </dd>
                <dt>Status</dt>
                <dd>
                  <span className={`status status-${booking.status}`}>
                    {booking.status}
                  </span>
                </dd>
              </dl>

              {booking.status === "confirmed" && (
                <CancelButton id={booking.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
