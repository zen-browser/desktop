// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * Gecko generic/specialized adjustments for xpcom and webidl types.
 */

// More specific types for parent process browsing contexts.
interface CanonicalBrowsingContext extends LoadContextMixin {
  embedderElement: XULBrowserElement;
  currentWindowContext: WindowGlobalParent;
  parent: CanonicalBrowsingContext;
  parentWindowContext: WindowGlobalParent;
  top: CanonicalBrowsingContext;
  topWindowContext: WindowGlobalParent;
}

interface ChromeWindow extends Window {
  isChromeWindow: true;
}

interface Document {
  createXULElement(name: 'browser'): XULBrowserElement;
}

type nsIGleanPingNoReason = {
  [K in keyof nsIGleanPing]: K extends 'submit' ? (_?: never) => void : nsIGleanPing[K];
};

type nsIGleanPingWithReason<T> = {
  [K in keyof nsIGleanPing]: K extends 'submit' ? (reason: T) => void : nsIGleanPing[K];
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

// Hand-crafted artisanal types.
interface XULBrowserElement extends XULFrameElement, FrameLoader {
  currentURI: nsIURI;
  docShellIsActive: boolean;
  isRemoteBrowser: boolean;
  remoteType: string;
}

// https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1736
interface Localization {
  formatValuesSync(aKeys: L10nKey[]): (string | null)[];
}
