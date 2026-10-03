import { describe, expect, it } from "vitest";
import { studentStatusLabel, studentStatusLabels } from "./status";

describe("student booking status labels", () => {
  it("maps each booking status to its student-facing label", () => {
    expect(studentStatusLabel({ status: "confirmed" })).toBe("Confirmed");
    expect(studentStatusLabel({ status: "cancelled" })).toBe("Cancelled");
  });

  it("covers exactly the two supported statuses", () => {
    expect(Object.keys(studentStatusLabels).sort()).toEqual([
      "cancelled",
      "confirmed",
    ]);
  });
});
