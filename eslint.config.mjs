// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

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
