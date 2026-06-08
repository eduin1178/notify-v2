/**
 * Helpers de transporte compartidos por el inbox (composer, diálogos de
 * plantilla/interactivo/inicio de conversación). Extraídos de `inbox-client.tsx`
 * para reutilizarlos desde los módulos del composer sin duplicar lógica.
 */

/**
 * Extrae un mensaje legible del cuerpo de error de la API. La forma canónica es
 * `{ error: { code, message, issues? } }` (ver `lib/api/errors.ts`), por lo que
 * el mensaje vive en `error.message`. Antes se leía `data.error` directamente y,
 * al ser un objeto, `new Error(objeto)` producía el literal "[object Object]".
 */
function extractApiErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const err = d.error;
    if (err && typeof err === "object") {
      const m = (err as Record<string, unknown>).message;
      if (typeof m === "string" && m.trim()) return m;
    }
    if (typeof err === "string" && err.trim()) return err;
    if (typeof d.message === "string" && d.message.trim()) return d.message;
  }
  return "No se pudo completar la operación.";
}

/** POST que ignora el cuerpo de respuesta; lanza el mensaje de error del dominio. */
export async function sendMessageRequest(
  url: string,
  body: unknown,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return;
  const data = await res.json().catch(() => null);
  throw new Error(extractApiErrorMessage(data));
}

/** Igual que `sendMessageRequest` pero devuelve el JSON de respuesta. */
export async function sendMessageRequestJson(
  url: string,
  body: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (res.ok) return data;
  throw new Error(extractApiErrorMessage(data));
}

/** Resultado de presignar y subir un archivo al almacenamiento de blobs. */
export type UploadResult = {
  publicUrl: string;
  category: "image" | "video" | "audio" | "document";
};

/**
 * Presigna una subida, sube el archivo por PUT a la URL firmada y devuelve la
 * URL pública y la categoría que el backend asignó (fuente de verdad del tipo).
 */
export async function uploadToBlob(
  orgId: string,
  file: File,
): Promise<UploadResult> {
  const contentType = file.type || "application/octet-stream";
  const presign = (await sendMessageRequestJson(
    `/api/v1/orgs/${orgId}/inbox/uploads`,
    { contentType, size: file.size, filename: file.name },
  )) as { uploadUrl: string; publicUrl: string; category: UploadResult["category"] };

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("No se pudo subir el archivo.");

  return { publicUrl: presign.publicUrl, category: presign.category };
}
