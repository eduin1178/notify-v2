"use client";

import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
};

/**
 * Paginador reutilizable y agnóstico del dominio. Recibe el estado de paginación
 * y notifica cambios por callbacks; no conoce qué se está paginando ni cómo se
 * persiste la página (URL, estado local, etc.). Pensado para reusarse en otros
 * módulos (contactos, y futuros listados).
 */
export function Pagination({
  page,
  pageSize,
  total,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: PaginationProps) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const hasPages = totalPages > 0;
  const isFirst = page <= 1;
  const isLast = !hasPages || page >= totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Primera página"
          disabled={disabled || isFirst}
          onClick={() => onPageChange(1)}
        >
          <CaretDoubleLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={disabled || isFirst}
          onClick={() => onPageChange(page - 1)}
        >
          <CaretLeftIcon />
        </Button>
        <span
          className="min-w-28 px-2 text-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          Página {hasPages ? page : 0} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página siguiente"
          disabled={disabled || isLast}
          onClick={() => onPageChange(page + 1)}
        >
          <CaretRightIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Última página"
          disabled={disabled || isLast}
          onClick={() => onPageChange(totalPages)}
        >
          <CaretDoubleRightIcon />
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Por página
        <NativeSelect
          className="h-7 w-20"
          value={pageSize}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Registros por página"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </NativeSelect>
      </label>
    </div>
  );
}
