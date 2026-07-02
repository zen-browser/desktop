/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/// <reference lib="es2024" />
/// <reference lib="esnext.iterator" />

/// <reference types="./lib.gecko.custom.d.ts" />
/// <reference types="./generated/lib.gecko.dom.d.ts" />
/// <reference types="./generated/lib.gecko.glean.d.ts" />
/// <reference types="./generated/lib.gecko.nsresult.d.ts" />
/// <reference types="./generated/lib.gecko.services.d.ts" />
/// <reference types="./generated/lib.gecko.xpcom.d.ts" />
/// <reference types="./lib.gecko.xpidl.d.ts" />

/// Platform specific XPCOM modules.
/// <reference types="./generated/lib.gecko.darwin.d.ts" />
/// <reference types="./generated/lib.gecko.linux.d.ts" />
/// <reference types="./generated/lib.gecko.win32.d.ts" />

/// Order of references matters here, for overriding type signatures.
/// <reference types="./lib.gecko.esnext.d.ts" />
/// <reference types="./lib.gecko.tweaks.d.ts" />

import type {} from "./lib.gecko.augmentations.d.ts";

declare global {
  const Cc: nsXPCComponents_Classes;
  const Ci: nsIXPCComponents_Interfaces;
  const Components: nsIXPCComponents;
  const Cr: nsIXPCComponents_Results;

  // Resolve typed generic overloads before the generated ones.
  const Cu: nsXPCComponents_Utils & nsIXPCComponents_Utils;

  const Services: JSServices;
  const uneval: (any) => string;
}

export {};

/// <reference types="./zen.d.ts" />
