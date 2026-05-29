import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyKapsoSignature } from "@/lib/integrations/kapso/webhook";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({ event: "whatsapp.phone_number.created" });

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyKapsoSignature", () => {
  it("acepta una firma válida", () => {
    expect(verifyKapsoSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true);
  });

  it("rechaza una firma con secreto distinto", () => {
    expect(verifyKapsoSignature(BODY, sign(BODY, "otro-secreto"), SECRET)).toBe(
      false,
    );
  });

  it("rechaza si el cuerpo fue alterado", () => {
    const signature = sign(BODY, SECRET);
    const tampered = JSON.stringify({ event: "whatsapp.phone_number.deleted" });
    expect(verifyKapsoSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("rechaza firma ausente", () => {
    expect(verifyKapsoSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyKapsoSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyKapsoSignature(BODY, "", SECRET)).toBe(false);
  });

  it("rechaza firma de longitud distinta sin lanzar", () => {
    expect(verifyKapsoSignature(BODY, "abc123", SECRET)).toBe(false);
  });
});
