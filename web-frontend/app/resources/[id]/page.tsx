import Link from "next/link";
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
      <Link href="/" className="back-link">
        &larr; All spaces
      </Link>

      <div className="detail-layout">
        <div className="detail-main">
          <p className="eyebrow">{room.building.name}</p>
          <h1>{room.name}</h1>
          <div className="detail-badges">
            <span className="code-plaque">{room.code}</span>
            <span className={`type type-${room.type}`}>{room.type}</span>
          </div>

          {room.description && <p className="detail-lead">{room.description}</p>}

          <dl className="detail-facts">
            <div>
              <dt>Location</dt>
              <dd>{room.location}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>{room.capacity} seats</dd>
            </div>
            {room.amenities.length > 0 && (
              <div>
                <dt>Amenities</dt>
                <dd>{room.amenities.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>

        <aside className="booking-panel" aria-label="Book this space">
          <h2>Book this space</h2>
          <p className="panel-note">Pick a date and a time range.</p>
          <BookingForm resourceId={room.id} />
        </aside>
      </div>
    </div>
  );
}
