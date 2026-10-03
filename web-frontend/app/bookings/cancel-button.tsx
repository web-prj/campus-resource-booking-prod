"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelBooking } from "@/lib/api";

export default function CancelButton({ id }: { id: string }) {
  const router = useRouter();
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
      await cancelBooking(id);
      // Refresh the page so the booking shows as cancelled.
      router.refresh();
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
