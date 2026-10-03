import Link from "next/link";
import { getRooms } from "@/lib/api";

// The home page shows the list of rooms we can book.
// This is a Server Component, so we can fetch the data right here.
export default async function HomePage() {
  const rooms = await getRooms();

  return (
    <div>
      <h1>Rooms</h1>

      {rooms.length === 0 ? (
        <p>No rooms are available right now.</p>
      ) : (
        <ul className="room-grid">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/resources/${room.id}`} className="room-card">
                <span className="tag">{room.type}</span>
                <h2>{room.name}</h2>
                <p className="room-code">{room.code}</p>
                <ul className="room-meta">
                  <li>Building: {room.building.name}</li>
                  <li>Capacity: {room.capacity}</li>
                  <li>Location: {room.location}</li>
                </ul>
                {room.amenities.length > 0 && (
                  <ul className="amenities">
                    {room.amenities.map((amenity) => (
                      <li key={amenity}>{amenity}</li>
                    ))}
                  </ul>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
