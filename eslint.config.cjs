const js = require("@eslint/js");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "**/dist/**", "**/.astro/**", "convex/_generated/**", ".beads/**"],
  },
  {
    files: ["**/*.{js,cjs,mjs}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
    },
  },
  {
    // Legacy and interoperability files that still rely on `any`.
    // Keep exceptions explicit so we can remove them incrementally.
    files: [
      "api/src/app.ts",
      "api/src/env.ts",
      "api/src/http/errors.ts",
      "api/src/queue/processors.ts",
      "api/src/routes/auth.ts",
      "api/src/routes/images.ts",
      "api/src/routes/telegram.ts",
      "api/src/routes/uploads.ts",
      "api/src/routes/votes.ts",
      "api/src/services/images/actions.ts",
      "convex/content.ts",
      "packages/config/src/env.ts",
      "**/*.test.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
