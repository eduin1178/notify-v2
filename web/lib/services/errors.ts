/**
 * Errores de dominio para la capa de servicios.
 *
 * Regla de la capa: NO importar nada de `next/*`, `hono`, `@hono/*` ni `web/app/**`.
 * Esta clase se lanza desde los servicios y la traduce a HTTP el adaptador (Hono / Server Action).
 */

export type DomainErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(params: { code: DomainErrorCode; status: number; message: string }) {
    super(params.message);
    this.name = "DomainError";
    this.code = params.code;
    this.status = params.status;
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}

export const DomainErrors = {
  unauthorized: (message = "No autenticado.") =>
    new DomainError({ code: "unauthorized", status: 401, message }),
  forbidden: (message = "No autorizado.") =>
    new DomainError({ code: "forbidden", status: 403, message }),
  notFound: (message = "Recurso no encontrado.") =>
    new DomainError({ code: "not_found", status: 404, message }),
  conflict: (message = "Conflicto.") =>
    new DomainError({ code: "conflict", status: 409, message }),
};
