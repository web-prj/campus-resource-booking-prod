import BookingList from "./booking-list";

// The "My bookings" page. Who is logged in is only known in the browser
// (localStorage), so the list itself is a Client Component.
export default function BookingsPage() {
  return (
    <div>
      <h1>My bookings</h1>
      <BookingList />
    </div>
  );
}
