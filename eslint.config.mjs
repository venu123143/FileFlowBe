// eslint.config.mjs
import tseslint from "typescript-eslint"
import eslintPlugin from "@typescript-eslint/eslint-plugin"

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "build", "scripts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": eslintPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  }
)
