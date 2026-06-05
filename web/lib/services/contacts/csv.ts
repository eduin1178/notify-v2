/**
 * Utilidades de CSV para contactos: parseo robusto (comillas, escapes, CRLF) y
 * serialización con neutralización de fórmulas (anti CSV injection).
 *
 * Módulo puro: NO importa `next/*`, `hono` ni `web/app/**`.
 */

/** Parsea un texto CSV a filas de celdas. Soporta comillas dobles y CRLF. */
export function parseCsv(text: string): string[][] {
  // Quita BOM si está presente.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Última celda/fila pendiente (archivo sin salto final).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** `true` si la fila está completamente vacía (debe ignorarse). */
export function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

/**
 * Escapa una celda para CSV. Neutraliza fórmulas anteponiendo `'` a los valores
 * que empiezan por `=`, `+`, `-` o `@` (CSV injection), y entrecomilla cuando
 * el valor contiene comas, comillas o saltos de línea.
 */
function escapeCsvField(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@]/.test(v)) {
    v = `'${v}`;
  }
  if (/[",\r\n]/.test(v)) {
    v = `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Serializa cabeceras + filas a un texto CSV (separador `\r\n`). */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\r\n");
}

/** Normaliza una cabecera: minúsculas, sin acentos, sin espacios sobrantes. */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
