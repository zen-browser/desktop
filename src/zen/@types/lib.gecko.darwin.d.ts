// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from source XPCOM .idl files.
 * If you're updating some of the sources, see README for instructions.
 */

declare global {
  // https://searchfox.org/mozilla-central/source/accessible/interfaces/nsIAccessibleMacInterface.idl

  interface nsIAccessibleMacNSObjectWrapper extends nsISupports {}

  interface nsIAccessibleMacInterface extends nsISupports {
    readonly attributeNames: string[];
    readonly parameterizedAttributeNames: string[];
    readonly actionNames: string[];
    getAttributeValue(attributeName: string): any;
    getParameterizedAttributeValue(attributeName: string, parameter: any): any;
    performAction(actionName: string): void;
    isAttributeSettable(attributeName: string): boolean;
    setAttributeValue(attributeName: string, attributeValue: any): void;
  }

  interface nsIAccessibleMacEvent extends nsISupports {
    readonly macIface: nsIAccessibleMacInterface;
    readonly data: any;
  }

  // https://searchfox.org/mozilla-central/source/browser/components/migration/nsIKeychainMigrationUtils.idl

  interface nsIKeychainMigrationUtils extends nsISupports {
    getGenericPassword(aServiceName: string, aAccountName: string): string;
  }

  // https://searchfox.org/mozilla-central/source/browser/components/shell/nsIMacShellService.idl

  interface nsIMacShellService extends nsIShellService {
    showDesktopPreferences(): void;
    showSecurityPreferences(aPaneID: string): void;
    getAvailableApplicationsForProtocol(protocol: string): string[][];
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIMacDockSupport.idl

  interface nsIAppBundleLaunchOptions extends nsISupports {
    readonly addsToRecentItems: boolean;
  }

  interface nsIMacDockSupport extends nsISupports {
    dockMenu: nsIStandaloneNativeMenu;
    activateApplication(aIgnoreOtherApplications: boolean): void;
    badgeText: string;
    setBadgeImage(aBadgeImage: imgIContainer, aPaintContext?: nsISVGPaintContext): void;
    readonly isAppInDock: boolean;
    ensureAppIsPinnedToDock(aAppPath?: string, aAppToReplacePath?: string): boolean;
    launchAppBundle(
      aAppBundle: nsIFile,
      aArgs: string[],
      aLaunchOptions?: nsIAppBundleLaunchOptions
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIMacFinderProgress.idl

  type nsIMacFinderProgressCanceledCallback = Callable<{
    canceled(): void;
  }>;

  interface nsIMacFinderProgress extends nsISupports {
    init(path: string, canceledCallback: nsIMacFinderProgressCanceledCallback): void;
    updateProgress(currentProgress: u64, totalProgress: u64): void;
    end(): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIMacSharingService.idl

  interface nsIMacSharingService extends nsISupports {
    getSharingProviders(pageUrl: string): any;
    shareUrl(serviceName: string, pageUrl: string, pageTitle: string): void;
    openSharingPreferences(): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIMacUserActivityUpdater.idl

  interface nsIMacUserActivityUpdater extends nsISupports {
    updateLocation(pageUrl: string, pageTitle: string, window: nsIBaseWindow): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIMacWebAppUtils.idl

  type nsITrashAppCallback = Callable<{
    trashAppFinished(rv: nsresult): void;
  }>;

  interface nsIMacWebAppUtils extends nsISupports {
    pathForAppWithIdentifier(bundleIdentifier: string): string;
    launchAppWithIdentifier(bundleIdentifier: string): void;
    trashApp(path: string, callback: nsITrashAppCallback): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIStandaloneNativeMenu.idl

  interface nsIStandaloneNativeMenu extends nsISupports {
    init(aElement: Element): void;
    menuWillOpen(): boolean;
    activateNativeMenuItemAt(anIndexString: string): void;
    forceUpdateNativeMenuAt(anIndexString: string): void;
    dump(): void;
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

  // https://searchfox.org/mozilla-central/source/widget/nsITouchBarHelper.idl

  interface nsITouchBarHelper extends nsISupports {
    readonly activeUrl: string;
    readonly activeTitle: string;
    readonly isUrlbarFocused: boolean;
    toggleFocusUrlbar(): void;
    unfocusUrlbar(): void;
    allItems: nsIArray;
    readonly document: Document;
    getTouchBarInput(aInputName: string): nsITouchBarInput;
    insertRestrictionInUrlbar(aToken: string): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITouchBarInput.idl

  type nsITouchBarInputCallback = Callable<{
    onCommand(): void;
  }>;

  interface nsITouchBarInput extends nsISupports {
    readonly key: string;
    title: string;
    image: nsIURI;
    type: string;
    callback: nsITouchBarInputCallback;
    color: u32;
    disabled: boolean;
    children: nsIArray;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITouchBarUpdater.idl

  interface nsITouchBarUpdater extends nsISupports {
    updateTouchBarInputs(aWindow: nsIBaseWindow, aInputs: nsITouchBarInput[]): void;
    enterCustomizeMode(): void;
    isTouchBarInitialized(): boolean;
    setTouchBarInitialized(aIsInitialized: boolean): void;
    showPopover(aWindow: nsIBaseWindow, aPopover: nsITouchBarInput, aShowing: boolean): void;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/base/nsIMacPreferencesReader.idl

  interface nsIMacPreferencesReader extends nsISupports {
    policiesEnabled(): boolean;
    readPreferences(): any;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/io/nsILocalFileMac.idl

  interface nsILocalFileMac extends nsIFile {
    readonly fileSizeWithResFork: i64;
    launchWithDoc(aDocToLoad: nsIFile, aLaunchInBackground: boolean): void;
    openDocWithApp(aAppToOpenWith: nsIFile, aLaunchInBackground: boolean): void;
    isPackage(): boolean;
    readonly bundleDisplayName: string;
    readonly bundleIdentifier: string;
    readonly bundleContentsLastModifiedTime: i64;
    hasXAttr(aAttrName: string): boolean;
    getXAttr(aAttrName: string): u8[];
    setXAttr(aAttrName: string, aAttrValue: u8[]): void;
    delXAttr(aAttrName: string): void;
  }

  interface nsIXPCComponents_Interfaces {
    nsIAccessibleMacNSObjectWrapper: nsJSIID<nsIAccessibleMacNSObjectWrapper>;
    nsIAccessibleMacInterface: nsJSIID<nsIAccessibleMacInterface>;
    nsIAccessibleMacEvent: nsJSIID<nsIAccessibleMacEvent>;
    nsIKeychainMigrationUtils: nsJSIID<nsIKeychainMigrationUtils>;
    nsIMacShellService: nsJSIID<nsIMacShellService>;
    nsIAppBundleLaunchOptions: nsJSIID<nsIAppBundleLaunchOptions>;
    nsIMacDockSupport: nsJSIID<nsIMacDockSupport>;
    nsIMacFinderProgressCanceledCallback: nsJSIID<nsIMacFinderProgressCanceledCallback>;
    nsIMacFinderProgress: nsJSIID<nsIMacFinderProgress>;
    nsIMacSharingService: nsJSIID<nsIMacSharingService>;
    nsIMacUserActivityUpdater: nsJSIID<nsIMacUserActivityUpdater>;
    nsITrashAppCallback: nsJSIID<nsITrashAppCallback>;
    nsIMacWebAppUtils: nsJSIID<nsIMacWebAppUtils>;
    nsIStandaloneNativeMenu: nsJSIID<nsIStandaloneNativeMenu>;
    nsITaskbarProgress: nsJSIID<nsITaskbarProgress>;
    nsITouchBarHelper: nsJSIID<nsITouchBarHelper>;
    nsITouchBarInputCallback: nsJSIID<nsITouchBarInputCallback>;
    nsITouchBarInput: nsJSIID<nsITouchBarInput>;
    nsITouchBarUpdater: nsJSIID<nsITouchBarUpdater>;
    nsIMacPreferencesReader: nsJSIID<nsIMacPreferencesReader>;
    nsILocalFileMac: nsJSIID<nsILocalFileMac>;
  }
} // global

// Typedefs from xpidl.
type PRTime = i64;
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
