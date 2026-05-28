import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import { isDomainError } from "@/lib/services/errors";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    issues?: Array<{ path: (string | number)[]; message: string }>;
  };
};

export function onError(err: Error, c: Context) {
  if (isDomainError(err)) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message },
    };
    return c.json(body, err.status as 400 | 401 | 403 | 404 | 409 | 500);
  }

  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: "validation_error",
        message: "La solicitud no cumple el esquema esperado.",
        issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
      },
    };
    return c.json(body, 400);
  }

  if (err instanceof HTTPException) {
    const body: ApiErrorBody = {
      error: {
        code: codeForStatus(err.status),
        message: err.message || "Error en la solicitud.",
      },
    };
    return c.json(body, err.status);
  }

  console.error("[api] error no manejado", err);
  const body: ApiErrorBody = {
    error: { code: "internal_error", message: "Error interno del servidor." },
  };
  return c.json(body, 500);
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return "validation_error";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limited";
    default:
      return "internal_error";
  }
}

export function notFoundHandler(c: Context) {
  const body: ApiErrorBody = {
    error: { code: "not_found", message: "Ruta no encontrada." },
  };
  return c.json(body, 404);
}
