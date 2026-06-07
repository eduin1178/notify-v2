/**
 * Adaptador de Cloudflare R2 (S3-compatible) para el media saliente del inbox
 * (change add-inbox, design D10).
 *
 * El navegador sube el archivo DIRECTO a R2 mediante una URL firmada (presigned
 * PUT) y el mensaje se envía a Kapso por `link` con la URL pública. Esto sortea
 * el límite de body (~4.5 MB) de las funciones serverless de Vercel.
 *
 * No es un módulo de servicios: lo consume `lib/services/inbox`. Aun así no
 * importa `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 *
 * Las credenciales de R2 son OPCIONALES en el entorno: si faltan, este módulo
 * lanza un error claro al intentar usarse (la app arranca igual).
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

/** La URL firmada caduca pronto: solo cubre la subida inmediata del navegador. */
const PRESIGN_EXPIRES_SECONDS = 300;

/** Límites de tamaño por categoría (alineados con los de WhatsApp/Meta). */
const MAX_BYTES_BY_CATEGORY: Record<MediaCategory, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

export type MediaCategory = "image" | "video" | "audio" | "document";

/** Error de configuración o validación del storage. El servicio lo traduce. */
export class R2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2Error";
  }
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

/** Devuelve la configuración de R2 o lanza si el entorno no la tiene completa. */
function requireConfig(): R2Config {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_BASE_URL,
  } = env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_BASE_URL
  ) {
    throw new R2Error(
      "El almacenamiento de archivos no está configurado. Define las variables R2_* en el entorno.",
    );
  }

  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBaseUrl: R2_PUBLIC_BASE_URL.replace(/\/+$/, ""),
  };
}

let cachedClient: S3Client | null = null;

function getClient(config: R2Config): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

/** Categoría de media a partir del `Content-Type`; null si no es soportada. */
export function categoryOf(contentType: string): MediaCategory | null {
  const ct = contentType.toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("video/")) return "video";
  if (ct.startsWith("audio/")) return "audio";
  // Todo lo demás (pdf, office, zip, etc.) cuenta como documento.
  if (ct.length > 0) return "document";
  return null;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/amr": "amr",
  "application/pdf": "pdf",
};

function extensionFor(contentType: string): string {
  const known = EXTENSION_BY_TYPE[contentType.toLowerCase()];
  if (known) return known;
  const guess = contentType.split("/")[1]?.split(";")[0]?.trim();
  return guess && /^[a-z0-9]+$/i.test(guess) ? guess : "bin";
}

export type PresignedUpload = {
  /** URL firmada para el PUT directo del navegador (caduca pronto). */
  uploadUrl: string;
  /** URL pública del objeto, usada como `link` al enviar a Kapso. */
  publicUrl: string;
  /** Categoría inferida del `Content-Type` (texto/imagen/doc/audio/video). */
  category: MediaCategory;
};

/**
 * Crea una URL firmada para subir un archivo directo a R2. Valida el tipo y el
 * tamaño contra los límites de Meta. El navegador hace `PUT uploadUrl` con el
 * archivo y el mismo `Content-Type`; luego se envía a Kapso con `publicUrl`.
 */
export async function createPresignedUpload(input: {
  contentType: string;
  size: number;
  /** Sugerencia de nombre (para preservar extensión/legibilidad del key). */
  filename?: string | null;
}): Promise<PresignedUpload> {
  const config = requireConfig();

  const category = categoryOf(input.contentType);
  if (!category) {
    throw new R2Error("Tipo de archivo no soportado.");
  }

  const maxBytes = MAX_BYTES_BY_CATEGORY[category];
  if (input.size <= 0) {
    throw new R2Error("El archivo está vacío.");
  }
  if (input.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new R2Error(`El archivo supera el límite de ${mb} MB para ${category}.`);
  }

  const ext = extensionFor(input.contentType);
  const key = `inbox/${category}/${crypto.randomUUID()}.${ext}`;

  const client = getClient(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.size,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRES_SECONDS,
  });

  return {
    uploadUrl,
    publicUrl: `${config.publicBaseUrl}/${key}`,
    category,
  };
}
