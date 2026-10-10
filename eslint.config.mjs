import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // CLAUDE.md 8.3: no component may import a raw colour. The deprecated
      // theme/colors.ts shim is deleted (step 14); this guard stops it coming
      // back. Use palette tokens (`sx={{ bgcolor: 'surface.panel' }}`) or
      // theme.vars.palette.*.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/theme/colors",
              message:
                "Deprecated: use palette tokens (sx={{ bgcolor: 'surface.panel' }}) or theme.vars.palette.* so the colour follows light/dark mode. See CLAUDE.md 8.3.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored pdf.js assets, copied from node_modules by scripts/copy-pdf-assets.mjs.
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
