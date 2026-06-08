/**
 * Copia el worker del codificador de `opus-recorder` a `public/opus/` para
 * servirlo como asset estático (lo necesita el grabador de audio del inbox).
 * El `.wasm` viene inlined en este worker, así que basta con un archivo.
 *
 * Se ejecuta en `postinstall` para que la copia vendorizada nunca quede
 * desfasada respecto a la versión instalada de la dependencia.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../node_modules/opus-recorder/dist/encoderWorker.min.js");
const dest = resolve(here, "../public/opus/encoderWorker.min.js");

if (!existsSync(src)) {
  // En instalaciones sin la dependencia (p. ej. CI parcial) no es un error duro.
  console.warn("[copy-opus-worker] no se encontró opus-recorder; se omite.");
  process.exit(0);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("[copy-opus-worker] encoderWorker.min.js copiado a public/opus/");
