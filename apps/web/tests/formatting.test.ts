import { describe, expect, it } from "vitest";
import { fareLabel, formatDistance, formatDuration } from "../lib/formatting";

describe("honest route labels", () => {
  it("keeps unknown measurements distinct from zero", () => {
    expect(formatDuration(null)).toBe("Time unavailable");
    expect(formatDistance(null)).toBe("Distance unavailable");
  });
  it("does not render an unknown fare as zero or a placeholder", () => {
    expect(fareLabel({ fare: { currency: "PHP", min: null, max: null, status: "unknown", sourceName: null, sourceUrl: null, checkedAt: null } } as never)).toBe("Fare unavailable");
  });
  it("marks demo money as an estimate and keeps the rounded range", () => {
    expect(fareLabel({ fare: { currency: "PHP", min: 80, max: 100, status: "estimated", sourceName: "demo", sourceUrl: null, checkedAt: null } } as never)).toBe("Est. ₱80–₱100");
  });
});
