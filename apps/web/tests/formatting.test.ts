import { describe, expect, it } from "vitest";
import { fareLabel, formatDistance, formatDuration, fullFareLabel } from "../lib/formatting";

describe("honest route labels", () => {
  it("keeps unknown measurements distinct from zero", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDistance(null)).toBe("—");
  });
  it("uses short, exact duration labels", () => {
    expect(formatDuration(59)).toBe("~1 min");
    expect(formatDuration(600)).toBe("~10 min");
    expect(formatDuration(3_600)).toBe("~1 hr");
    expect(formatDuration(3_900)).toBe("~1 hr 5 min");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
  it("formats small fares normally and compact fares accessibly without estimate prefixes", () => {
    const small = { currency: "PHP" as const, min: 80, max: 120, status: "estimated" as const, sourceName: "demo", sourceUrl: null, checkedAt: null };
    const large = { ...small, min: 12_300, max: 19_600 };
    expect(fareLabel(small)).toBe("₱80–₱120");
    expect(fareLabel(large)).toBe("₱12.3k–₱19.6k");
    expect(fullFareLabel(large)).toBe("₱12,300–₱19,600");
    expect(fareLabel({ ...small, min: null, max: null })).toBe("—");
    expect(fareLabel({ ...small, min: 12_000, max: 12_000 })).toBe("₱12k");
  });
});
