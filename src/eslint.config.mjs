import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/include": [
        "domain/**/*",
        "application/**/*",
        "infrastructure/**/*",
        "app/**/*",
        "components/**/*",
        "lib/**/*",
        "test/**/*",
      ],
      "boundaries/elements": [
        { type: "domain", pattern: "domain", mode: "folder" },
        { type: "application", pattern: "application", mode: "folder" },
        { type: "infrastructure", pattern: "infrastructure", mode: "folder" },
        { type: "app", pattern: "app", mode: "folder" },
        { type: "components", pattern: "components", mode: "folder" },
        { type: "lib", pattern: "lib", mode: "folder" },
        { type: "test", pattern: "test", mode: "folder" },
      ],
    },
    rules: {
      "boundaries/no-unknown": "off",
      "boundaries/no-unknown-files": "off",
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "domain", allow: ["domain"] },
            { from: "application", allow: ["domain", "application"] },
            {
              from: "infrastructure",
              allow: ["domain", "application", "infrastructure"],
            },
            {
              from: "app",
              allow: [
                "domain",
                "application",
                "infrastructure",
                "app",
                "components",
                "lib",
              ],
            },
            { from: "components", allow: ["components", "lib"] },
            { from: "lib", allow: ["lib"] },
            {
              from: "test",
              allow: [
                "domain",
                "application",
                "infrastructure",
                "test",
                "lib",
              ],
            },
            {
              from: ["application", "infrastructure", "app", "test"],
              allow: ["domain"],
              importKind: "type",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
