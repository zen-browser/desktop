/**
 * Gecko generic/specialized adjustments for xpcom and webidl types.
 */

// More specific types for parent process browsing contexts.
interface CanonicalBrowsingContext extends LoadContextMixin {
  embedderElement: MozBrowser;
  currentWindowContext: WindowGlobalParent;
  parent: CanonicalBrowsingContext;
  parentWindowContext: WindowGlobalParent;
  top: CanonicalBrowsingContext;
  topWindowContext: WindowGlobalParent;
}

declare namespace ChromeUtils {
  type Modules = import("./generated/lib.gecko.modules").Modules;

  function importESModule<T extends keyof Modules>(
    aResourceURI: T,
    aOptions?: ImportESModuleOptionsDictionary
  ): Modules[T];
}

interface ChromeWindow extends Window {
  isChromeWindow: true;
}

interface XULElementTagNameMap {
  browser: MozBrowser;
  iframe: XULFrameElement;
  label: XULTextElement;
  menu: XULMenuElement;
  menupopup: XULPopupElement;
  tree: XULTreeElement;
}

interface Document {
  createXULElement<K extends keyof XULElementTagNameMap>(
    localName: K,
    options?: string | ElementCreationOptions
  ): XULElementTagNameMap[K];
  createXULElement(
    localName: string,
    options?: string | ElementCreationOptions
  ): XULElement;
}

type nsIGleanPingNoReason = {
  [K in keyof nsIGleanPing]: K extends "submit"
    ? (_?: never) => void
    : nsIGleanPing[K];
};

type nsIGleanPingWithReason<T> = {
  [K in keyof nsIGleanPing]: K extends "submit"
    ? (reason: T) => void
    : nsIGleanPing[K];
};

interface MessageListenerManagerMixin {
  // Overloads that define `data` arg as required, since it's ~always expected.
  addMessageListener(
    msg: string,
    listener: { receiveMessage(_: ReceiveMessageArgument & { data }) }
  );
  removeMessageListener(
    msg: string,
    listener: { receiveMessage(_: ReceiveMessageArgument & { data }) }
  );
}

interface MozQueryInterface {
  <T>(iid: T): nsQIResult<T>;
}

interface nsICryptoHash extends nsISupports {
  // Accepts a TypedArray.
  update(aData: ArrayLike<number>, aLen: number): void;
}

interface nsIDOMWindow extends Window {}

interface nsISimpleEnumerator extends Iterable<any> {}

interface nsISupports {
  wrappedJSObject?: object;
}

interface nsIXPCComponents_Constructor {
  <const T, IIDs = nsIXPCComponents_Interfaces>(
    cid,
    id: T,
    init?
  ): {
    new (...any): nsQIResult<T extends keyof IIDs ? IIDs[T] : T>;
    (...any): nsQIResult<T extends keyof IIDs ? IIDs[T] : T>;
  };
}

interface ComponentsExceptionOptions {
  result?: number;
  stack?: nsIStackFrame;
  data?: object;
}

interface nsIException extends Exception {}

interface nsIXPCComponents_Exception {
  (
    message?: string,
    resultOrOptions?: number | ComponentsExceptionOptions,
    stack?: nsIStackFrame,
    data?: object
  ): nsIException;
}

interface nsIXPCComponents_ID {
  (uuid: string): nsID;
}

interface nsIXPCComponents_utils_Sandbox {
  (principal: nsIPrincipal | nsIPrincipal[], options: object): Sandbox;
}

interface nsXPCComponents_Classes {
  [cid: string]: {
    createInstance<T>(aID: T): nsQIResult<T>;
    getService<T>(aID?: T): unknown extends T ? nsISupports : nsQIResult<T>;
  };
}

// Generic overloads.
interface nsXPCComponents_Utils {
  cloneInto<T>(value: T, ...any): T;
  createObjectIn<T = object>(_, object?: T): T;
  exportFunction<T>(func: T, ...any): T;
  getWeakReference<T>(value: T): { get(): T };
  waiveXrays<T>(object: T): T;
}

type Sandbox = typeof globalThis & nsISupports;

interface WindowGlobalParent extends WindowContext {
  readonly browsingContext: CanonicalBrowsingContext;
}

// https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1736
interface Localization {
  formatValuesSync(aKeys: L10nKey[]): (string | null)[];
}

/**
 * Redefine the DOMStringMap interface to match its implementation.
 * xref Bug 1965336.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMStringMap)
 */
interface DOMStringMap {
  [name: string]: string | undefined;
}

/**
 * Define base64/hex methods for Uint8Array
 * https://github.com/microsoft/TypeScript/issues/61695
 */
interface Uint8Array<TArrayBuffer extends ArrayBufferLike> {
  setFromBase64(
    string: string,
    options?: { alphabet?: string; lastChunkHandling: string }
  ): { read: number; written: number };
  setFromHex(string: string): { read: number; written: number };
  toBase64(options?: { alphabet?: string; omitPadding: boolean }): string;
  toHex(): string;
}
