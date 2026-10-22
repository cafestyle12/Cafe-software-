import { describe, expect, it } from "vitest";
import { plannedCapabilities } from "./roadmap";

describe("CafeOS foundation roadmap", () => {
  it("lists the initial product domains", () => {
    expect(plannedCapabilities.map(({ title }) => title)).toEqual([
      "Point of sale",
      "Kitchen operations",
      "QR ordering",
      "Business control",
    ]);
  });

  it("clearly marks every capability as planned, not enabled", () => {
    expect(plannedCapabilities).toHaveLength(4);
    expect(plannedCapabilities.every(({ status }) => status === "Planned")).toBe(true);
    expect(plannedCapabilities.every(({ description }) => description.length > 20)).toBe(true);
  });
});
