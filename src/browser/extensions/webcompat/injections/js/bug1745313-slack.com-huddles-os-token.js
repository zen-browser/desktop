/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const spoofedUA = navigator.userAgent.replace(
  /X11; Linux [^;)]+/,
  "Windows NT 10.0; Win64; x64"
);

if (spoofedUA !== navigator.userAgent) {
  const nav = Object.getPrototypeOf(navigator);
  const ua = Object.getOwnPropertyDescriptor(nav, "userAgent");
  ua.get = () => spoofedUA;
  Object.defineProperty(nav, "userAgent", ua);
}
