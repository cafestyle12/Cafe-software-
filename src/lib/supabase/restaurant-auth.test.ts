import { describe, expect, it } from "vitest";
import { generateInternalAuthEmail, generateRestaurantId, generateTemporaryPassword, isValidRestaurantId, normalizeRestaurantId, validateRestaurantPasswordChange } from "../restaurant-credentials";

describe("restaurant credential generation", () => {
  it("accepts custom human-readable Restaurant IDs and rejects unsafe formats", () => {
    expect(isValidRestaurantId("YASHCAFE01")).toBe(true);
    expect(isValidRestaurantId("CAFE-FIROZABAD-01")).toBe(true);
    expect(isValidRestaurantId("coffee_house")).toBe(true);
    expect(isValidRestaurantId("ab")).toBe(false);
    expect(isValidRestaurantId("bad id")).toBe(false);
    expect(isValidRestaurantId("../admin")).toBe(false);
    expect(isValidRestaurantId("x".repeat(33))).toBe(false);
  });
  it("normalizes Restaurant IDs consistently", () => {
    expect(normalizeRestaurantId(" cafe-ab12-34cd56ef ")).toBe("CAFE-AB12-34CD56EF");
    expect(normalizeRestaurantId("bad id")).toBe("BAD ID");
    expect(isValidRestaurantId(normalizeRestaurantId("bad id"))).toBe(false);
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


describe("restaurant password change validation", () => {
  it("accepts a strong new password that differs from the current password", () => {
    expect(validateRestaurantPasswordChange("Temporary!aA9", "NewStrong!Password42", "NewStrong!Password42")).toBeNull();
  });

  it("rejects passwords that are too short, too long, or miss required character classes", () => {
    expect(validateRestaurantPasswordChange("old", "Short!A1", "Short!A1")).toBe("weak_password");
    expect(validateRestaurantPasswordChange("old", "a".repeat(129) + "A1!", "a".repeat(129) + "A1!")).toBe("weak_password");
    expect(validateRestaurantPasswordChange("old", "lowercaseonly123!", "lowercaseonly123!")).toBe("weak_password");
  });

  it("rejects mismatched confirmation", () => {
    expect(validateRestaurantPasswordChange("old", "NewStrong!Password42", "NewStrong!Password43")).toBe("password_mismatch");
  });

  it("rejects reusing the current or temporary password", () => {
    expect(validateRestaurantPasswordChange("Temporary!aA9", "Temporary!aA9", "Temporary!aA9")).toBe("must_differ_from_current");
    expect(validateRestaurantPasswordChange("", "NewStrong!Password42", "NewStrong!Password42")).toBe("must_differ_from_current");
  });
});


describe("restaurant password policy", () => {
  it("accepts a strong matching first-login password without requiring the temporary password", () => {
    expect(validateRestaurantPasswordChange("", "NewStrongPassword9!", "NewStrongPassword9!", false)).toBeNull();
  });

  it("requires the new password to differ from the current password for later changes", () => {
    expect(validateRestaurantPasswordChange("CurrentStrong9!", "CurrentStrong9!", "CurrentStrong9!")).toBe("must_differ_from_current");
    expect(validateRestaurantPasswordChange("CurrentStrong9!", "NewStrongPassword9!", "NewStrongPassword9!")).toBeNull();
  });

  it("rejects weak passwords and mismatched confirmation", () => {
    expect(validateRestaurantPasswordChange("", "weak", "weak", false)).toBe("weak_password");
    expect(validateRestaurantPasswordChange("", "NewStrongPassword9!", "NewStrongPassword10!", false)).toBe("password_mismatch");
  });
});
