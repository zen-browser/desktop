// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const fs = require('fs');
const MJS_FILES = ['src/zen/split-view/ZenViewSplitter.ts'];

for (const file of MJS_FILES) {
  const code = fs.readFileSync(file, 'utf8');
  require('@babel/core').transformSync(code, {
    presets: ['@babel/preset-typescript'],
    filename: file,
  });
}
