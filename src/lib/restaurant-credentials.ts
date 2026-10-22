import { randomBytes } from "node:crypto";

export function normalizeRestaurantId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function generateRestaurantId() {
  const token = randomBytes(6).toString("hex").toUpperCase();
  return `CAFE-${token.slice(0, 4)}-${token.slice(4)}`;
}

export function generateTemporaryPassword() {
  return randomBytes(24).toString("base64url") + "!aA9";
}

export function generateInternalAuthEmail() {
  return `${randomBytes(16).toString("hex")}@auth.cafeos.invalid`;
}
