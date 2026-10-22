import { describe, expect, it } from "vitest";
import { generateInternalAuthEmail, generateRestaurantId, generateTemporaryPassword, normalizeRestaurantId } from "../restaurant-credentials";

describe("restaurant credential generation", () => {
  it("normalizes Restaurant IDs consistently", () => {
    expect(normalizeRestaurantId(" cafe-ab12-34cd56ef ")).toBe("CAFE-AB12-34CD56EF");
  });

  it("generates a unique-looking Restaurant ID in the enforced format", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRestaurantId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^CAFE-[A-Z0-9]{4}-[A-Z0-9]{8}$/);
  });

  it("generates strong temporary passwords without storing them", () => {
    for (let index = 0; index < 20; index += 1) {
      const password = generateTemporaryPassword();
      expect(password.length).toBeGreaterThanOrEqual(12);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("generates non-deliverable internal Supabase identities with collision-resistant local parts", () => {
    const emails = new Set(Array.from({ length: 100 }, () => generateInternalAuthEmail()));
    expect(emails.size).toBe(100);
    for (const email of emails) expect(email).toMatch(/^[a-f0-9]{32}@auth\.cafeos\.invalid$/);
  });
});
