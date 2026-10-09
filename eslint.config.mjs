import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // CLAUDE.md 8.3: no component may import a raw colour. theme/colors.ts is
      // a deprecated shim kept only so the pre-redesign screens keep rendering
      // while they are migrated one step at a time. New code uses palette
      // tokens (`sx={{ bgcolor: 'surface.panel' }}`) or theme.vars.palette.*.
      //
      // This is a WARNING for now because ~26 files still import the shim.
      // It becomes an ERROR in the final step of Task A, when the shim is
      // deleted.
      "no-restricted-imports": [
        "warn",
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
  ]),
]);

export default eslintConfig;
