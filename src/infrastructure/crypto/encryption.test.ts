import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  _resetKeyCacheForTests,
  decrypt,
  encrypt,
  type Encrypted,
} from "./encryption";

const ENCRYPTED_PATTERN = /^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

beforeAll(() => {
  process.env.ENCRYPTION_KEY_V1 = randomBytes(32).toString("base64");
});

afterEach(() => {
  _resetKeyCacheForTests();
});

describe("encrypt", () => {
  it("produces a value matching v1:<iv>:<ciphertext>:<authTag> base64 format", () => {
    const value = encrypt("secret-token-123");
    expect(value).toMatch(ENCRYPTED_PATTERN);
  });

  it("does not leak plaintext into the ciphertext", () => {
    const plaintext = "secret-token-123";
    const value = encrypt(plaintext);
    expect(value).not.toContain(plaintext);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
  });
});

describe("decrypt", () => {
  it("round-trips arbitrary plaintext", () => {
    const plaintext = "secret-token-123 with símbolos áéíóú 🔐";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("throws when the ciphertext has been tampered with", () => {
    const value = encrypt("secret-token-123");
    const parts = value.split(":");
    const ciphertext = Buffer.from(parts[2]!, "base64");
    ciphertext[0] = ciphertext[0]! ^ 0x01;
    parts[2] = ciphertext.toString("base64");
    const tampered = parts.join(":") as Encrypted;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when the auth tag has been tampered with", () => {
    const value = encrypt("secret-token-123");
    const parts = value.split(":");
    const tag = Buffer.from(parts[3]!, "base64");
    tag[0] = tag[0]! ^ 0x01;
    parts[3] = tag.toString("base64");
    const tampered = parts.join(":") as Encrypted;
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws with a clear message for an unknown key version", () => {
    expect(() => decrypt("v99:aaaa:bbbb:cccc")).toThrow(
      /Unknown encryption key version: 99/,
    );
  });

  it("throws on malformed input that does not match the expected shape", () => {
    expect(() => decrypt("not-an-encrypted-value" as Encrypted)).toThrow(
      /Invalid encrypted value format/,
    );
  });
});
