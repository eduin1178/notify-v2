import { describe, expect, it } from "vitest";
import { parseEnv } from "./schema";
import { randomBytes } from "node:crypto";

const validKey = randomBytes(32).toString("base64");

describe("parseEnv", () => {
  it("returns parsed env when all vars are valid", () => {
    const env = parseEnv({
      DATABASE_URL: "postgres://user:pass@localhost:5432/notify",
      ENCRYPTION_KEY_V1: validKey,
      NODE_ENV: "test",
    });
    expect(env.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/notify");
    expect(env.NODE_ENV).toBe("test");
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() =>
      parseEnv({
        ENCRYPTION_KEY_V1: validKey,
        NODE_ENV: "test",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("throws when DATABASE_URL is not a valid URL", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "not-a-url",
        ENCRYPTION_KEY_V1: validKey,
        NODE_ENV: "test",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("throws when ENCRYPTION_KEY_V1 does not decode to 32 bytes", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/notify",
        ENCRYPTION_KEY_V1: Buffer.from("too-short").toString("base64"),
        NODE_ENV: "test",
      }),
    ).toThrow(/32 bytes/);
  });

  it("throws when NODE_ENV is unsupported", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/notify",
        ENCRYPTION_KEY_V1: validKey,
        NODE_ENV: "staging",
      }),
    ).toThrow(/NODE_ENV/);
  });
});
