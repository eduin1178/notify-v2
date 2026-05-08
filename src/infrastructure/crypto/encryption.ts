import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type Encrypted = `v${number}:${string}`;

const CURRENT_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

const keyCache = new Map<number, Buffer>();

function getKey(version: number): Buffer {
  const cached = keyCache.get(version);
  if (cached) return cached;

  const raw = process.env[`ENCRYPTION_KEY_V${version}`];
  if (!raw) {
    throw new Error(`Unknown encryption key version: ${version}`);
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY_V${version} must decode to 32 bytes`);
  }

  keyCache.set(version, key);
  return key;
}

export function encrypt(plaintext: string): Encrypted {
  const key = getKey(CURRENT_VERSION);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `v${CURRENT_VERSION}:${iv.toString("base64")}:${ciphertext.toString("base64")}:${authTag.toString("base64")}`;
}

export function decrypt(value: Encrypted): string {
  const match = /^v(\d+):([^:]+):([^:]+):([^:]+)$/.exec(value);
  if (!match) {
    throw new Error("Invalid encrypted value format");
  }

  const version = Number(match[1]);
  const iv = Buffer.from(match[2]!, "base64");
  const ciphertext = Buffer.from(match[3]!, "base64");
  const authTag = Buffer.from(match[4]!, "base64");

  const key = getKey(version);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function _resetKeyCacheForTests(): void {
  keyCache.clear();
}
