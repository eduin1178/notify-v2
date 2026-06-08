/**
 * Helpers de transporte compartidos por el inbox (composer, diálogos de
 * plantilla/interactivo/inicio de conversación). Extraídos de `inbox-client.tsx`
 * para reutilizarlos desde los módulos del composer sin duplicar lógica.
 */

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
  const message =
    (data && (data.message || data.error)) ||
    "No se pudo completar la operación.";
  throw new Error(message);
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
  const message =
    (data && (data.message || data.error)) ||
    "No se pudo completar la operación.";
  throw new Error(message);
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
