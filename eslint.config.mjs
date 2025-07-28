import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import zenGlobals from './src/zen/zen.globals.js';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...zenGlobals.reduce((acc, global) => {
          acc[global] = 'readable';
          return acc;
        }, {}),
      },
    },
    ignores: ['**/vendor/**', '**/tests/**'],
  },
]);
