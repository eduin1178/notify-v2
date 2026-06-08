"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Borrador de adjunto del composer. v1 soporta UN adjunto a la vez, pero el
 * estado vive aquí (no en el `Composer`) porque varias fuentes lo alimentan:
 * el selector de archivos y el pegado (dentro del composer) y el arrastrar y
 * soltar (sobre el panel de conversación, fuera del composer). El audio NO pasa
 * por este borrador: tiene su propio flujo de grabación/previsualización.
 */
export type DraftKind = "image" | "video" | "document";

export type DraftAttachment = {
  file: File;
  kind: DraftKind;
  /** Object URL para previsualizar imagen/video; `null` para documento. */
  previewUrl: string | null;
};

const TOO_MANY = "Solo se adjunta un archivo a la vez.";

function kindFromFile(file: File): DraftKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

export type AttachmentDraft = {
  attachment: DraftAttachment | null;
  error: string | null;
  /** Adjunta el primer archivo; si llega más de uno, avisa y conserva el primero. */
  addFiles: (files: FileList | File[]) => void;
  clear: () => void;
  setError: (message: string | null) => void;
};

export function useAttachmentDraft(): AttachmentDraft {
  const [attachment, setAttachment] = useState<DraftAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mantén la URL viva para revocarla al reemplazar o desmontar (evita fugas).
  const previewRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      const file = arr[0];
      const kind = kindFromFile(file);
      const previewUrl =
        kind === "document" ? null : URL.createObjectURL(file);
      revoke();
      previewRef.current = previewUrl;
      setAttachment({ file, kind, previewUrl });
      setError(arr.length > 1 ? TOO_MANY : null);
    },
    [revoke],
  );

  const clear = useCallback(() => {
    revoke();
    setAttachment(null);
    setError(null);
  }, [revoke]);

  // Revoca cualquier URL pendiente al desmontar.
  useEffect(() => revoke, [revoke]);

  return { attachment, error, addFiles, clear, setError };
}
