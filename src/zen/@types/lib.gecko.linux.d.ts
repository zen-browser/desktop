// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from source XPCOM .idl files.
 * If you're updating some of the sources, see README for instructions.
 */

declare global {
  // https://searchfox.org/mozilla-central/source/browser/components/shell/nsIGNOMEShellService.idl

  interface nsIGNOMEShellService extends nsIShellService {
    readonly canSetDesktopBackground: boolean;
    isDefaultForScheme(aScheme: string): boolean;
  }

  // https://searchfox.org/mozilla-central/source/browser/components/shell/nsIOpenTabsProvider.idl

  interface nsIOpenTabsProvider extends nsISupports {
    getOpenTabs(): string[];
    switchToOpenTab(url: string): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIApplicationChooser.idl

  type nsIApplicationChooserFinishedCallback = Callable<{
    done(handlerApp: nsIHandlerApp): void;
  }>;

  interface nsIApplicationChooser extends nsISupports {
    init(parent: mozIDOMWindowProxy, title: string): void;
    open(
      contentType: string,
      applicationChooserFinishedCallback: nsIApplicationChooserFinishedCallback
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIGtkTaskbarProgress.idl

  interface nsIGtkTaskbarProgress extends nsITaskbarProgress {
    setPrimaryWindow(aWindow: mozIDOMWindowProxy): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITaskbarProgress.idl

  interface nsITaskbarProgress extends nsISupports {
    readonly STATE_NO_PROGRESS?: 0;
    readonly STATE_INDETERMINATE?: 1;
    readonly STATE_NORMAL?: 2;
    readonly STATE_ERROR?: 3;
    readonly STATE_PAUSED?: 4;

    setProgressState(state: nsTaskbarProgressState, currentValue?: u64, maxValue?: u64): void;
  }

  interface nsIXPCComponents_Interfaces {
    nsIGNOMEShellService: nsJSIID<nsIGNOMEShellService>;
    nsIOpenTabsProvider: nsJSIID<nsIOpenTabsProvider>;
    nsIApplicationChooserFinishedCallback: nsJSIID<nsIApplicationChooserFinishedCallback>;
    nsIApplicationChooser: nsJSIID<nsIApplicationChooser>;
    nsIGtkTaskbarProgress: nsJSIID<nsIGtkTaskbarProgress>;
    nsITaskbarProgress: nsJSIID<nsITaskbarProgress>;
  }
} // global

// Typedefs from xpidl.
type PRTime = i64;
type nsHandlerInfoAction = i32;
type nsTaskbarProgressState = i32;

// XPCOM internal utility types.

/** XPCOM inout param is passed in as a js object with a value property. */
type InOutParam<T> = { value: T };

/** XPCOM out param is written to the passed in object's value property. */
type OutParam<T> = { value?: T };

/** Enable interfaces to inherit from enums: pick variants as optional. */
type Enums<enums> = Partial<Pick<enums, keyof enums>>;

/** Callable accepts either form of a [function] interface. */
type Callable<iface> = iface | Extract<iface[keyof iface], Function>;

export {};
