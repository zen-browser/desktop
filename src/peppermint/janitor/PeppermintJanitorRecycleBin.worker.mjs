/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* globals ctypes */

/**
 * Windows only. Empties the recycle bin of the current user through the shell
 * API, off the main thread because it can take a while on a big bin.
 *
 * In:  { dryRun: boolean }
 * Out: { ok: boolean, bytes: number, items: number }
 *
 * Any failure answers { ok: false } and leaves the bin as it was.
 */

const SHERB_NOCONFIRMATION = 0x1;
const SHERB_NOPROGRESSUI = 0x2;
const SHERB_NOSOUND = 0x4;

function run(dryRun) {
  const shell32 = ctypes.open("shell32.dll");
  try {
    const QueryInfo = new ctypes.StructType("SHQUERYRBINFO", [
      { cbSize: ctypes.uint32_t },
      { i64Size: ctypes.int64_t },
      { i64NumItems: ctypes.int64_t },
    ]);
    const query = shell32.declare(
      "SHQueryRecycleBinW",
      ctypes.winapi_abi,
      ctypes.int32_t,
      ctypes.char16_t.ptr,
      QueryInfo.ptr
    );
    const empty = shell32.declare(
      "SHEmptyRecycleBinW",
      ctypes.winapi_abi,
      ctypes.int32_t,
      ctypes.voidptr_t,
      ctypes.char16_t.ptr,
      ctypes.uint32_t
    );

    const info = new QueryInfo();
    info.cbSize = QueryInfo.size;
    // A null root means every drive.
    if (query(null, info.address()) !== 0) {
      return { ok: false, bytes: 0, items: 0 };
    }
    const bytes = Number(info.i64Size.toString());
    const items = Number(info.i64NumItems.toString());
    if (dryRun || !items) {
      return { ok: true, bytes: dryRun ? bytes : 0, items: dryRun ? items : 0 };
    }

    const flags = SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND;
    if (empty(null, null, flags) !== 0) {
      return { ok: false, bytes: 0, items: 0 };
    }
    return { ok: true, bytes, items };
  } finally {
    shell32.close();
  }
}

self.onmessage = event => {
  let reply = { ok: false, bytes: 0, items: 0 };
  try {
    reply = run(!!event.data?.dryRun);
  } catch (e) {
    // Leave the failure reply.
  }
  self.postMessage(reply);
};
