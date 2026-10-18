
import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import sonarjs from "eslint-plugin-sonarjs";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {
      js,
      sonarjs,
    },
    extends: ["js/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      complexity: ["error", 0],
      "sonarjs/cognitive-complexity": ["error", 0],
    },
  },
]);
