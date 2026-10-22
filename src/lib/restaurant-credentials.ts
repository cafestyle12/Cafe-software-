import { randomBytes } from "node:crypto";

export function normalizeRestaurantId(value: string) {
  return value.trim().toUpperCase();
}

export function isValidRestaurantId(value: string) {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(value.trim().toUpperCase());
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

export function validateRestaurantPasswordChange(currentPassword: string, password: string, confirmation: string, requireDifferentFromCurrent = true) {
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "weak_password" as const;
  }
  if (password !== confirmation) return "password_mismatch" as const;
  if (requireDifferentFromCurrent && (!currentPassword || password === currentPassword)) return "must_differ_from_current" as const;
  return null;
}
