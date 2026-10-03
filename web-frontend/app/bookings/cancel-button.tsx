"use client";

import { useState } from "react";
import { cancelBooking } from "@/lib/api";
import type { Booking } from "@/lib/types";

export default function CancelButton({
  id,
  userId,
  onCancelled,
}: {
  id: string;
  userId: string;
  onCancelled: (booking: Booking) => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    // Ask the student to confirm before cancelling.
    const confirmed = window.confirm(
      "Are you sure you want to cancel this booking?",
    );
    if (!confirmed) {
      return;
    }

    setCancelling(true);
    try {
      const updated = await cancelBooking(id, userId);
      // Tell the list so the booking shows as cancelled.
      onCancelled(updated);
    } catch {
      window.alert("Sorry, the booking could not be cancelled.");
      setCancelling(false);
    }
  }

  return (
    <button
      type="button"
      className="button-danger"
      onClick={handleCancel}
      disabled={cancelling}
    >
      {cancelling ? "Cancelling..." : "Cancel booking"}
    </button>
  );
}
