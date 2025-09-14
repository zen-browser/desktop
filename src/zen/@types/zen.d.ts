// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from source .webidl files.
 */
/**
 * This file from https://phabricator.services.mozilla.com/D209620,
 * the source of https://bugzilla.mozilla.org/show_bug.cgi?id=1895418
 * Currently https://searchfox.org/mozilla-central/source/tools/%40types
 * in 2024-12-28 21:05 KST
 */

/// <reference types="../lib.gecko.xpcom.d.ts" />
/// <reference types="../lib.gecko.services.d.ts" />
/// <reference types="../lib.gecko.dom.d.ts" />
/// <reference types="../lib.gecko.tweaks.d.ts" />
/// <reference types="../lib.gecko.nsresult.d.ts" />

declare var window: Window;
declare var Components: nsIXPCComponents;
declare var Cu: nsIXPCComponents_Utils;
declare var Ci: nsIXPCComponents_Interfaces;
declare var Services: JSServices;
declare var Cc: nsIXPCComponents_Classes & {
  [key: string]: {
    getService: (t: (typeof Ci)[keyof typeof Ci]) => any;
    createInstance: (aClass: (typeof Ci)[keyof typeof Ci]) => any;
  };
};
interface CSSStyleDeclaration {
  display: string;
  flex: string;
  order: string;
  flexDirection: string;
  flexTemplateAreas: string;
  height: string;
  animation: string;
}

interface nsIXPCComponents extends nsISupports {
  readonly interfaces: nsIXPCComponents_Interfaces;
  readonly results: nsIXPCComponents_Results;
  isSuccessCode(result: any): boolean;
  readonly classes: nsIXPCComponents_Classes;
  readonly stack: nsIStackFrame;
  readonly manager: nsIComponentManager;
  readonly utils: nsIXPCComponents_Utils;
  readonly ID: nsIXPCComponents_ID;
  readonly Exception: any;
  readonly Constructor: (aClass: any, aIID: any, aFlags: any) => any;
  returnCode: any;
}

/**
 * TS-TODO - Needs typing.
 *
 * This file contains type stubs for loading things from Gecko. All of these
 * types should be used in the correct places eventually.
 */

/**
 * Namespace anything that has its types mocked out here. These definitions are
 * only "good enough" to get the type checking to pass in this directory.
 * Eventually some more structured solution should be found. This namespace is
 * global and makes sure that all the definitions inside do not clash with
 * naming.
 */
declare namespace MockedExports {
  /**
   * This interface teaches ChromeUtils.importESModule how to find modules.
   */
  interface KnownModules {
    Services: typeof import('Services');
    'resource://gre/modules/AppConstants.sys.mjs': typeof import('resource://gre/modules/AppConstants.sys.mjs');
    'resource:///modules/CustomizableUI.sys.mjs': typeof import('resource:///modules/CustomizableUI.sys.mjs');
    'resource:///modules/CustomizableWidgets.sys.mjs': typeof import('resource:///modules/CustomizableWidgets.sys.mjs');
  }

  interface ChromeUtils {
    /**
     * This function reads the KnownModules and resolves which import to use.
     * If you are getting the TS2345 error:
     *
     *  Argument of type '"resource:///.../file.sys.mjs"' is not assignable to
     *  parameter of type
     *
     * Then add the file path to the KnownModules above.
     */
    importESModule: <S extends keyof KnownModules>(module: S) => KnownModules[S];
    defineESModuleGetters: (target: any, mappings: any) => void;
  }

  interface MessageManager {
    loadFrameScript(url: string, flag: boolean): void;
    sendAsyncMessage: (event: string, data: any) => void;
    addMessageListener: (event: string, listener: (event: any) => void) => void;
  }

  // This is the thing in window.gBrowser, defined in
  // https://searchfox.org/mozilla-central/source/browser/base/content/tabbrowser.js
  interface Browser {
    addWebTab: (url: string, options: any) => BrowserTab;
    contentPrincipal: any;
    selectedTab: BrowserTab;
    selectedBrowser?: ChromeBrowser;
    messageManager: MessageManager;
    ownerDocument?: ChromeDocument;
    tabs: BrowserTab[];
  }

  interface BrowserGroup {
    readonly tabs: BrowserTab[];
    readonly group?: BrowserGroup;
  }

  // This is a tab in a browser, defined in
  // https://searchfox.org/mozilla-central/rev/6b8a3f804789fb865f42af54e9d2fef9dd3ec74d/browser/base/content/tabbrowser.js#2580
  interface BrowserTab extends XULElement {
    linkedBrowser: ChromeBrowser;
    readonly group?: BrowserGroup;
  }

  interface BrowserWindow extends Window {
    gBrowser: Browser;
    focus(): void;
  }

  // The thing created in https://searchfox.org/mozilla-central/rev/6b8a3f804789fb865f42af54e9d2fef9dd3ec74d/browser/base/content/tabbrowser.js#2088
  // This is linked to BrowserTab.
  interface ChromeBrowser {
    browsingContext?: BrowsingContext;
    browserId: number;
  }

  interface BrowsingContext {
    /**
     * A unique identifier for the browser element that is hosting this
     * BrowsingContext tree. Every BrowsingContext in the element's tree will
     * return the same ID in all processes and it will remain stable regardless of
     * process changes. When a browser element's frameloader is switched to
     * another browser element this ID will remain the same but hosted under the
     * under the new browser element.
     * We are using this identifier for getting the active tab ID and passing to
     * the profiler back-end. See `getActiveBrowserID` for the usage.
     */
    browserId: number;
  }

  type GetPref<T> = (prefName: string, defaultValue?: T) => T;
  type SetPref<T> = (prefName: string, value?: T) => T;
  type nsIPrefBranch = {
    clearUserPref: (prefName: string) => void;
    getStringPref: GetPref<string>;
    setStringPref: SetPref<string>;
    getCharPref: GetPref<string>;
    setCharPref: SetPref<string>;
    getIntPref: GetPref<number>;
    setIntPref: SetPref<number>;
    getBoolPref: GetPref<boolean>;
    setBoolPref: SetPref<boolean>;
    addObserver: (aDomain: string, aObserver: PrefObserver, aHoldWeak?: boolean) => void;
    removeObserver: (aDomain: string, aObserver: PrefObserver) => void;
  };

  type PrefObserverFunction = (
    aSubject: nsIPrefBranch,
    aTopic: 'nsPref:changed',
    aData: string
  ) => unknown;
  type PrefObserver = PrefObserverFunction | { observe: PrefObserverFunction };

  interface nsIURI {}

  interface SharedLibrary {
    start: number;
    end: number;
    offset: number;
    name: string;
    path: string;
    debugName: string;
    debugPath: string;
    breakpadId: string;
    arch: string;
  }

  interface ProfileGenerationAdditionalInformation {
    sharedLibraries: SharedLibrary[];
  }

  interface ProfileAndAdditionalInformation {
    profile: ArrayBuffer;
    additionalInformation?: ProfileGenerationAdditionalInformation;
  }

  type Services = {
    env: {
      set: (name: string, value: string) => void;
      get: (name: string) => string;
      exists: (name: string) => boolean;
    };
    prefs: nsIPrefBranch;
    profiler: {
      StartProfiler: (
        entryCount: number,
        interval: number,
        features: string[],
        filters?: string[],
        activeTabId?: number,
        duration?: number
      ) => void;
      StopProfiler: () => void;
      IsPaused: () => boolean;
      Pause: () => void;
      Resume: () => void;
      IsSamplingPaused: () => boolean;
      PauseSampling: () => void;
      ResumeSampling: () => void;
      GetFeatures: () => string[];
      getProfileDataAsync: (sinceTime?: number) => Promise<object>;
      getProfileDataAsArrayBuffer: (sinceTime?: number) => Promise<ArrayBuffer>;
      getProfileDataAsGzippedArrayBuffer: (
        sinceTime?: number
      ) => Promise<ProfileAndAdditionalInformation>;
      IsActive: () => boolean;
      sharedLibraries: SharedLibrary[];
    };
    platform: string;
    obs: {
      addObserver: (observer: object, type: string) => void;
      removeObserver: (observer: object, type: string) => void;
    };
    wm: {
      getMostRecentWindow: (name: string) => BrowserWindow;
      getMostRecentNonPBWindow: (name: string) => BrowserWindow;
    };
    focus: {
      activeWindow: BrowserWindow;
    };
    io: {
      newURI(url: string): nsIURI;
    };
    scriptSecurityManager: any;
    startup: {
      quit: (optionsBitmask: number) => void;
      eForceQuit: number;
      eRestart: number;
    };
  };

  const EventEmitter: {
    decorate: (target: object) => void;
  };

  const AppConstantsSYSMJS: {
    AppConstants: {
      platform: string;
    };
  };

  interface BrowsingContextStub {}
  interface PrincipalStub {}

  interface WebChannelTarget {
    browsingContext: BrowsingContextStub;
    browser: Browser;
    eventTarget: null;
    principal: PrincipalStub;
  }

  interface FaviconData {
    uri: nsIURI;
    dataLen: number;
    data: number[];
    mimeType: string;
    size: number;
  }

  const PlaceUtilsSYSMJS: {
    PlacesUtils: {
      // TS-TODO: Add the rest.
    };
  };

  // TS-TODO
  const CustomizableUISYSMJS: any;
  const CustomizableWidgetsSYSMJS: any;
  const PanelMultiViewSYSMJS: any;

  const LoaderESM: {
    require: (path: string) => any;
  };

  const Services: Services;

  // This class is needed by the Cc importing mechanism. e.g.
  // Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  class nsIFilePicker {}

  interface FilePicker {
    init: (browsingContext: BrowsingContext, title: string, mode: number) => void;
    open: (callback: (rv: number) => unknown) => void;
    // The following are enum values.
    modeGetFolder: number;
    returnOK: number;
    file: {
      path: string;
    };
  }

  interface Cc {
    '@mozilla.org/filepicker;1': {
      createInstance(instance: nsIFilePicker): FilePicker;
    };
  }

  interface Ci {
    nsIFilePicker: nsIFilePicker;
  }

  interface Cu {
    exportFunction: (fn: Function, scope: object, options?: object) => void;
    cloneInto: (value: any, scope: object, options?: object) => void;
    isInAutomation: boolean;
  }

  interface FluentLocalization {
    /**
     * This function sets the attributes data-l10n-id and possibly data-l10n-args
     * on the element.
     */
    setAttributes(target: Element, id?: string, args?: Record<string, string>): void;
  }
}

interface PathUtilsInterface {
  split: (path: string) => string[];
  isAbsolute: (path: string) => boolean;
}

declare module 'Services' {
  export = MockedExports.Services;
}

declare module 'ChromeUtils' {
  export = ChromeUtils;
}

declare var ChromeUtils: MockedExports.ChromeUtils;

declare var PathUtils: PathUtilsInterface;

// These global objects can be used directly in JSM files only.
declare var Cu: MockedExports.Cu;
declare var Cc: MockedExports.Cc;
declare var Ci: MockedExports.Ci;
declare var Services: MockedExports.Services;

/**
 * This is a variant on the normal Document, as it contains chrome-specific properties.
 */
declare interface ChromeDocument extends Document {
  /**
   * Create a XUL element of a specific type. Right now this function
   * only refines iframes, but more tags could be added.
   */
  createXULElement: ((type: 'iframe') => XULIframeElement) & ((type: string) => XULElement);

  /**
   * This is a fluent instance connected to this document.
   */
  l10n: MockedExports.FluentLocalization;
}

/**
 * This is a variant on the HTMLElement, as it contains chrome-specific properties.
 */
declare interface ChromeHTMLElement extends HTMLElement {
  ownerDocument: ChromeDocument;
}

declare interface XULIframeElement extends XULElement {
  contentWindow: Window;
  src: string;
}

// `declare interface Window` is TypeScript way to let us implicitely extend and
// augment the already existing Window interface defined in the TypeScript library.
// This makes it possible to define properties that exist in the window object
// while in a privileged context. We assume that all of the environments we run
// in this project will be pribileged, that's why we take this shortcut of
// globally extending the Window type.
// See the ChromeOnly attributes in https://searchfox.org/mozilla-central/rev/896042a1a71066254ceb5291f016ca3dbca21cb7/dom/webidl/Window.webidl#391
//
// openWebLinkIn and openTrustedLinkIn aren't in all privileged windows, but
// they're also defined in the privileged environments we're dealing with in
// this project, so they're defined here for convenience.
declare interface Window {
  browsingContext: MockedExports.BrowsingContext;
  openWebLinkIn: (
    url: string,
    where: 'current' | 'tab' | 'tabshifted' | 'window' | 'save',
    options?: Partial<{
      // Not all possible options are present, please add more if/when needed.
      userContextId: number;
      forceNonPrivate: boolean;
      relatedToCurrent: boolean;
      resolveOnContentBrowserCreated: (contentBrowser: MockedExports.ChromeBrowser) => unknown;
    }>
  ) => void;
  openTrustedLinkIn: (
    url: string,
    where: 'current' | 'tab' | 'tabshifted' | 'window' | 'save',
    options?: Partial<{
      // Not all possible options are present, please add more if/when needed.
      userContextId: number;
      forceNonPrivate: boolean;
      relatedToCurrent: boolean;
      resolveOnContentBrowserCreated: (contentBrowser: MockedExports.ChromeBrowser) => unknown;
    }>
  ) => void;
}

declare class ChromeWorker extends Worker {}

declare interface MenuListElement extends XULElement {
  value: string;
  disabled: boolean;
}

declare interface XULCommandEvent extends Event {
  target: XULElement;
}

declare interface XULElementWithCommandHandler {
  addEventListener: (
    type: 'command',
    handler: (event: XULCommandEvent) => void,
    isCapture?: boolean
  ) => void;
  removeEventListener: (
    type: 'command',
    handler: (event: XULCommandEvent) => void,
    isCapture?: boolean
  ) => void;
}

declare type nsIPrefBranch = MockedExports.nsIPrefBranch;

// chrome context-only DOM isInstance method
// XXX: This hackishly extends Function because there is no way to extend DOM constructors.
// Callers should manually narrow the type when needed.
// See also https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/222
interface Function {
  isInstance(obj: any): boolean;
}
