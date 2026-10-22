import { describe, expect, it } from "vitest";
import { plannedCapabilities } from "./roadmap";

describe("CafeOS foundation roadmap", () => {
  it("lists the access foundation before the planned operating domains", () => {
    expect(plannedCapabilities.map(({ title }) => title)).toEqual([
      "Authentication and workspaces",
      "Point of sale",
      "Kitchen operations",
      "QR ordering",
      "Business control",
    ]);
  });

  it("marks only the active foundation as in progress", () => {
    expect(plannedCapabilities).toHaveLength(5);
    expect(plannedCapabilities[0].status).toBe("In progress");
    expect(plannedCapabilities.slice(1).every(({ status }) => status === "Planned")).toBe(true);
    expect(plannedCapabilities.every(({ description }) => description.length > 20)).toBe(true);
  });
});
