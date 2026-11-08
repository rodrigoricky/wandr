import js from "@eslint/js";
import parser from "@typescript-eslint/parser";
import globals from "globals";

export default [
  { ignores: ["**/.next/**", "**/out/**", "**/node_modules/**", "**/coverage/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
      globals: { ...globals.browser, ...globals.node, ...globals.worker },
    },
    rules: { "no-undef": "off", "no-unused-vars": "off" },
  },
];
