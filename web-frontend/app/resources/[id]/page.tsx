import { notFound } from "next/navigation";
import { getRoom } from "@/lib/api";
import type { Room } from "@/lib/types";
import BookingForm from "./booking-form";

// The detail page for a single room. It shows the room info and
// a form to book it. This is a Server Component.
export default async function ResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Try to load the room. If it is not found, show the 404 page.
  let room: Room;
  try {
    room = await getRoom(id);
  } catch {
    notFound();
  }

  return (
    <div>
      <h1>{room.name}</h1>
      <p className="room-code">
        {room.code} <span className="tag">{room.type}</span>
      </p>

      <ul className="detail-meta">
        <li>Building: {room.building.name}</li>
        <li>Location: {room.location}</li>
        <li>Capacity: {room.capacity}</li>
        {room.amenities.length > 0 && (
          <li>Amenities: {room.amenities.join(", ")}</li>
        )}
      </ul>

      {room.description && <p>{room.description}</p>}

      <h2>Book this room</h2>
      <BookingForm resourceId={room.id} />
    </div>
  );
}
