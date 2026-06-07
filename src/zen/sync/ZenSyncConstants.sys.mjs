/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const RECORD_TYPES = Object.freeze({
  SPACE: "space",
  CONTAINER: "container",
  TAB: "tab",
  FOLDER: "folder",
  SPLIT: "split",
});

export const RECORD_ID_PREFIX_BY_TYPE = Object.freeze({
  [RECORD_TYPES.SPACE]: "s",
  [RECORD_TYPES.CONTAINER]: "c",
  [RECORD_TYPES.TAB]: "t",
  [RECORD_TYPES.FOLDER]: "f",
  [RECORD_TYPES.SPLIT]: "sv",
});

export const RECORD_TYPE_BY_PREFIX = Object.freeze({
  s: RECORD_TYPES.SPACE,
  c: RECORD_TYPES.CONTAINER,
  t: RECORD_TYPES.TAB,
  f: RECORD_TYPES.FOLDER,
  sv: RECORD_TYPES.SPLIT,
});
