import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Assets minificados de terceros (p. ej. el worker WASM de opus en
    // `public/opus/`): no son código del proyecto y no deben lintarse.
    "**/*.min.js",
  ]),
]);

export default eslintConfig;
