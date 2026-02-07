const js = require("@eslint/js");
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
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
