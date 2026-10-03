import Link from "next/link";
import { getRooms } from "@/lib/api";

// The home page shows the list of rooms we can book.
// This is a Server Component, so we can fetch the data right here.
export default async function HomePage() {
  const rooms = await getRooms();

  // Real numbers for the hero, worked out from the data we loaded.
  const buildingCount = new Set(rooms.map((room) => room.building.name)).size;

  return (
    <div>
      <section className="hero">
        <p className="hero-eyebrow">USTH campus</p>
        <h1>Book a campus space</h1>
        <p className="hero-lead">
          Browse rooms, labs, and equipment, then reserve a time that works for
          you.
        </p>
        {rooms.length > 0 && (
          <p className="hero-stats">
            {rooms.length} spaces across {buildingCount}{" "}
            {buildingCount === 1 ? "building" : "buildings"}
          </p>
        )}
      </section>

      <h2 className="section-title">Available spaces</h2>

      {rooms.length === 0 ? (
        <p className="empty">No rooms are available right now.</p>
      ) : (
        <ul className="room-grid">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={`/resources/${room.id}`} className="room-card">
                <div className="room-card-top">
                  <span className="eyebrow">{room.building.name}</span>
                  <span className={`type type-${room.type}`}>{room.type}</span>
                </div>

                <h3 className="room-name">{room.name}</h3>
                <span className="code-plaque">{room.code}</span>

                <ul className="room-meta">
                  <li>
                    <span className="meta-value">{room.capacity}</span> seats
                  </li>
                  <li>{room.location}</li>
                </ul>

                {room.amenities.length > 0 && (
                  <ul className="amenities">
                    {room.amenities.map((amenity) => (
                      <li key={amenity}>{amenity}</li>
                    ))}
                  </ul>
                )}

                <span className="room-cta">Book this space &rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
