import { describe, expect, it } from "vitest";
import { qrcodegen } from "./qrcodegen";

describe("private QR encoder", () => {
  it("encodes a table URL into a standards-compliant QR matrix", () => {
    const url = "https://cafe.example/t/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    const code = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
    expect(code.size).toBeGreaterThanOrEqual(21);
    expect(code.size).toBeLessThanOrEqual(177);
    expect(code.size % 4).toBe(1);
    expect(typeof code.getModule(0, 0)).toBe("boolean");
    expect(typeof code.getModule(code.size - 1, code.size - 1)).toBe("boolean");
  });

  it("encodes the same payload deterministically", () => {
    const url = "https://cafe.example/t/one-time-secret";
    const first = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
    const second = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
    expect(first.size).toBe(second.size);
    for (let y = 0; y < first.size; y++) {
      for (let x = 0; x < first.size; x++) {
        expect(first.getModule(x, y)).toBe(second.getModule(x, y));
      }
    }
  });
});
