// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * Gecko XPIDL base types.
 */

/**
 * Generic IDs are created by most code which passes a nsID to js.
 * https://searchfox.org/mozilla-central/source/js/xpconnect/src/XPCJSID.cpp#24
 */
interface nsID<uuid = string> {
  readonly number: uuid;
}

/**
 * In addition to nsID, interface IIDs support instanceof type guards,
 * and expose constants defined on the class, including variants from enums.
 * https://searchfox.org/mozilla-central/source/js/xpconnect/src/XPCJSID.cpp#45
 */
type nsJSIID<iface, enums = {}> = nsID &
  Constants<iface> &
  enums & {
    new (_: never): void;
    prototype: iface;
  };

/** A union type of all known interface IIDs. */
type nsIID = nsIXPCComponents_Interfaces[keyof nsIXPCComponents_Interfaces];

/** A generic to resolve QueryInterface return type from a nsIID. */
type nsQIResult<iid> = iid extends { prototype: infer U } ? U : never;

/** Picks only const number properties from T. */
type Constants<T> = { [K in keyof T as IfConst<K, T[K]>]: T[K] };

/** Resolves only for keys K whose corresponding type T is a narrow number. */
type IfConst<K, T> = T extends number ? (number extends T ? never : K) : never;

/** u32 */
type nsresult = u32;

// Numeric typedefs, useful as a quick reference in method signatures.
type double = number;
type float = number;
type i16 = number;
type i32 = number;
type i64 = number;
type u16 = number;
type u32 = number;
type u64 = number;
type u8 = number;
