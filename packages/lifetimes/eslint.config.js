import { defineConfig } from "eslint/config";
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    "rules": {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "ignoreRestSiblings": true,
          "argsIgnorePattern": "^_"
        }
      ]
    }
  },
);