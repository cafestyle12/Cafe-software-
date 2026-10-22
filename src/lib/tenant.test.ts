import { describe, expect, it } from "vitest";
import { isValidTenantSlug, normalizeTenantSlug } from "./tenant";

describe("tenant slug normalization", () => {
  it("normalizes display names into URL-safe slugs", () => {
    expect(normalizeTenantSlug("The Daily Grind Café")).toBe("the-daily-grind-cafe");
    expect(normalizeTenantSlug("  Main & Co.  ")).toBe("main-co");
  });

  it("caps the slug length and removes edge separators", () => {
    expect(normalizeTenantSlug("--Cafe--")).toBe("cafe");
    expect(normalizeTenantSlug("a".repeat(100))).toHaveLength(80);
  });

  it("rejects empty, uppercase, repeated-edge, or malformed slugs", () => {
    expect(isValidTenantSlug("daily-grind")).toBe(true);
    expect(isValidTenantSlug("a")).toBe(false);
    expect(isValidTenantSlug("-daily")).toBe(false);
    expect(isValidTenantSlug("daily-")).toBe(false);
    expect(isValidTenantSlug("Daily-Grind")).toBe(false);
    expect(isValidTenantSlug("daily--grind")).toBe(false);
  });
});
