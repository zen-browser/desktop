// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from source XPCOM .idl files.
 * If you're updating some of the sources, see README for instructions.
 */

declare global {
  // https://searchfox.org/mozilla-central/source/toolkit/components/aboutthirdparty/nsIAboutThirdParty.idl

  interface nsIInstalledApplication extends nsISupports {
    readonly name: string;
    readonly publisher: string;
  }

  interface nsIAboutThirdParty extends nsISupports {
    readonly ModuleType_Unknown?: 1;
    readonly ModuleType_IME?: 2;
    readonly ModuleType_ShellExtension?: 4;
    readonly ModuleType_BlockedByUser?: 8;
    readonly ModuleType_BlockedByUserAtLaunch?: 16;

    lookupModuleType(aLeafName: string): u32;
    lookupApplication(aModulePath: string): nsIInstalledApplication;
    readonly isDynamicBlocklistAvailable: boolean;
    readonly isDynamicBlocklistDisabled: boolean;
    updateBlocklist(aLeafName: string, aNewBlockStatus: boolean): Promise<any>;
    collectSystemInfo(): Promise<any>;
    loadModuleForTesting(aModulePath: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/aboutwindowsmessages/nsIAboutWindowsMessages.idl

  interface nsIAboutWindowsMessages extends nsISupports {
    getMessages(
      currentWindow: mozIDOMWindowProxy,
      messages: OutParam<string[][]>,
      windowTitles: OutParam<string[]>
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/alerts/nsIWindowsAlertsService.idl
} // global

declare enum nsIWindowsAlertNotification_ImagePlacement {
  eInline = 0,
  eHero = 1,
  eIcon = 2,
}

declare global {
  namespace nsIWindowsAlertNotification {
    type ImagePlacement = nsIWindowsAlertNotification_ImagePlacement;
  }

  interface nsIWindowsAlertNotification
    extends nsIAlertNotification,
      Enums<typeof nsIWindowsAlertNotification_ImagePlacement> {
    imagePlacement: nsIWindowsAlertNotification.ImagePlacement;
  }

  interface nsIWindowsAlertsService extends nsIAlertsService {
    handleWindowsTag(aWindowsTag: string): Promise<any>;
    getXmlStringForWindowsAlert(aAlert: nsIAlertNotification, aWindowsTag?: string): string;
    removeAllNotificationsForInstall(): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/mozapps/defaultagent/nsIDefaultAgent.idl

  interface nsIDefaultAgent extends nsISupports {
    registerTask(aUniqueToken: string): void;
    updateTask(aUniqueToken: string): void;
    unregisterTask(aUniqueToken: string): void;
    uninstall(aUniqueToken: string): void;
    secondsSinceLastAppRun(): i64;
    getDefaultBrowser(): string;
    getReplacePreviousDefaultBrowser(aCurrentBrowser: string): string;
    getDefaultPdfHandler(): string;
    sendPing(
      aCurrentBrowser: string,
      aPreviousBrowser: string,
      aPdfHandler: string,
      aNotificationShown: string,
      aNotificationAction: string,
      daysSinceLastAppLaunch: u32
    ): void;
    setDefaultBrowserUserChoice(aAumid: string, aExtraFileExtensions: string[]): void;
    setDefaultBrowserUserChoiceAsync(aAumid: string, aExtraFileExtensions: string[]): Promise<any>;
    setDefaultExtensionHandlersUserChoice(aAumid: string, aFileExtensions: string[]): void;
    agentDisabled(): boolean;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/mozapps/defaultagent/nsIWindowsMutex.idl

  interface nsIWindowsMutex extends nsISupports {
    tryLock(): void;
    isLocked(): boolean;
    unlock(): void;
  }

  interface nsIWindowsMutexFactory extends nsISupports {
    createMutex(aName: string): nsIWindowsMutex;
  }

  // https://searchfox.org/mozilla-central/source/dom/geolocation/nsIGeolocationUIUtilsWin.idl

  interface nsIGeolocationUIUtilsWin extends nsISupports {
    dismissPrompts(aBC: BrowsingContext): void;
  }

  // https://searchfox.org/mozilla-central/source/netwerk/socket/nsINamedPipeService.idl

  // https://searchfox.org/mozilla-central/source/browser/components/shell/nsIWindowsShellService.idl
} // global

declare enum nsIWindowsShellService_LaunchOnLoginEnabledEnumerator {
  LAUNCH_ON_LOGIN_DISABLED_BY_SETTINGS = 0,
  LAUNCH_ON_LOGIN_DISABLED = 1,
  LAUNCH_ON_LOGIN_ENABLED = 2,
  LAUNCH_ON_LOGIN_ENABLED_BY_POLICY = 3,
}

declare global {
  namespace nsIWindowsShellService {
    type LaunchOnLoginEnabledEnumerator = nsIWindowsShellService_LaunchOnLoginEnabledEnumerator;
  }

  interface nsIWindowsShellService
    extends nsIShellService,
      Enums<typeof nsIWindowsShellService_LaunchOnLoginEnabledEnumerator> {
    createShortcut(
      aBinary: nsIFile,
      aArguments: string[],
      aDescription: string,
      aIconFile: nsIFile,
      aIconIndex: u16,
      aAppUserModelId: string,
      aShortcutFolder: string,
      aShortcutName: string
    ): Promise<any>;
    getLaunchOnLoginShortcuts(): string[];
    pinCurrentAppToStartMenuAsync(aCheckOnly: boolean): Promise<any>;
    isCurrentAppPinnedToStartMenuAsync(): Promise<any>;
    enableLaunchOnLoginMSIXAsync(aTaskId: string): Promise<any>;
    disableLaunchOnLoginMSIXAsync(aTaskId: string): Promise<any>;
    getLaunchOnLoginEnabledMSIXAsync(aTaskId: string): Promise<any>;
    pinCurrentAppToTaskbarAsync(aPrivateBrowsing: boolean): Promise<any>;
    checkPinCurrentAppToTaskbarAsync(aPrivateBrowsing: boolean): Promise<any>;
    isCurrentAppPinnedToTaskbarAsync(aumid: string): Promise<any>;
    pinShortcutToTaskbar(aAppUserModelId: string, aShortcutPath: string): Promise<any>;
    createWindowsIcon(aFile: nsIFile, aContainer: imgIContainer): Promise<any>;
    unpinShortcutFromTaskbar(aShortcutPath: string): void;
    getTaskbarTabShortcutPath(aShortcutName: string): string;
    getTaskbarTabPins(): string[];
    classifyShortcut(aPath: string): string;
    hasPinnableShortcut(aAUMID: string, aPrivateBrowsing: boolean): Promise<any>;
    canSetDefaultBrowserUserChoice(): boolean;
    checkAllProgIDsExist(): boolean;
    checkBrowserUserChoiceHashes(): boolean;
    isDefaultHandlerFor(aFileExtensionOrProtocol: string): boolean;
    queryCurrentDefaultHandlerFor(aFileExtensionOrProtocol: string): string;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/components/taskscheduler/nsIWinTaskSchedulerService.idl

  interface nsIWinTaskSchedulerService extends nsISupports {
    registerTask(
      aFolderName: string,
      aTaskName: string,
      aDefinitionXML: string,
      aUpdateExisting?: boolean
    ): void;
    validateTaskDefinition(aDefinitionXML: string): i32;
    getTaskXML(aFolderName: string, aTaskName: string): string;
    getCurrentUserSid(): string;
    deleteTask(aFolderName: string, aTaskName: string): void;
    getFolderTasks(aFolderName: string): string[];
    createFolder(aParentFolderName: string, aSubFolderName: string): void;
    deleteFolder(aParentFolderName: string, aSubFolderName: string): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIJumpListBuilder.idl

  interface nsIJumpListBuilder extends nsISupports {
    obtainAndCacheFavicon(faviconURL: nsIURI): string;
    obtainAndCacheFaviconAsync(faviconURL: nsIURI): Promise<any>;
    isAvailable(): Promise<any>;
    checkForRemovals(): Promise<any>;
    populateJumpList(
      aTaskDescriptions: any,
      aCustomTitle: string,
      aCustomDescriptions: any
    ): Promise<any>;
    clearJumpList(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIPrintSettingsWin.idl

  // https://searchfox.org/mozilla-central/source/widget/nsITaskbarOverlayIconController.idl

  interface nsITaskbarOverlayIconController extends nsISupports {
    setOverlayIcon(
      statusIcon: imgIContainer,
      statusDescription: string,
      paintContext?: nsISVGPaintContext
    ): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITaskbarPreview.idl

  interface nsITaskbarPreview extends nsISupports {
    controller: nsITaskbarPreviewController;
    tooltip: string;
    visible: boolean;
    active: boolean;
    invalidate(): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITaskbarPreviewButton.idl

  interface nsITaskbarPreviewButton extends nsISupports {
    tooltip: string;
    dismissOnClick: boolean;
    hasBorder: boolean;
    disabled: boolean;
    image: imgIContainer;
    visible: boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITaskbarPreviewController.idl

  type nsITaskbarPreviewCallback = Callable<{
    done(aCanvas: nsISupports, aDrawBorder: boolean): void;
  }>;

  interface nsITaskbarPreviewController extends nsISupports {
    readonly width: u32;
    readonly height: u32;
    readonly thumbnailAspectRatio: float;
    requestPreview(aCallback: nsITaskbarPreviewCallback): void;
    requestThumbnail(aCallback: nsITaskbarPreviewCallback, width: u32, height: u32): void;
    onClose(): void;
    onActivate(): boolean;
    onClick(button: nsITaskbarPreviewButton): void;
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

  // https://searchfox.org/mozilla-central/source/widget/nsITaskbarTabPreview.idl

  interface nsITaskbarTabPreview extends nsITaskbarPreview {
    title: string;
    icon: imgIContainer;
    move(aNext: nsITaskbarTabPreview): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsITaskbarWindowPreview.idl

  interface nsITaskbarWindowPreview extends nsITaskbarPreview {
    readonly NUM_TOOLBAR_BUTTONS?: 7;

    getButton(index: u32): nsITaskbarPreviewButton;
    enableCustomDrawing: boolean;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIWinTaskbar.idl

  interface nsIWinTaskbar extends nsISupports {
    readonly available: boolean;
    readonly defaultGroupId: string;
    readonly defaultPrivateGroupId: string;
    createTaskbarTabPreview(
      shell: nsIDocShell,
      controller: nsITaskbarPreviewController
    ): nsITaskbarTabPreview;
    getTaskbarWindowPreview(shell: nsIDocShell): nsITaskbarWindowPreview;
    getTaskbarProgress(shell: nsIDocShell): nsITaskbarProgress;
    getOverlayIconController(shell: nsIDocShell): nsITaskbarOverlayIconController;
    createJumpListBuilder(aPrivateBrowsing: boolean): nsIJumpListBuilder;
    getGroupIdForWindow(aParent: mozIDOMWindow): string;
    setGroupIdForWindow(aParent: mozIDOMWindow, aIdentifier: string): void;
  }

  // https://searchfox.org/mozilla-central/source/widget/nsIWindowsUIUtils.idl

  interface nsIWindowsUIUtils extends nsISupports {
    readonly systemSmallIconSize: i32;
    readonly systemLargeIconSize: i32;
    setWindowIcon(
      aWindow: mozIDOMWindowProxy,
      aSmallIcon: imgIContainer,
      aLargeIcon: imgIContainer
    ): void;
    setWindowIconFromExe(aWindow: mozIDOMWindowProxy, aExe: string, aIndex: u16): void;
    setWindowIconNoData(aWindow: mozIDOMWindowProxy): void;
    readonly inWin10TabletMode: boolean;
    readonly inWin11TabletMode: boolean;
    shareUrl(shareTitle: string, urlToShare: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/system/windowsPackageManager/nsIWindowsPackageManager.idl

  interface nsIWindowsPackageManager extends nsISupports {
    findUserInstalledPackages(prefix: string[]): string[];
    getInstalledDate(): u64;
    campaignId(): Promise<any>;
  }

  // https://searchfox.org/mozilla-central/source/xpcom/ds/nsIWindowsRegKey.idl

  interface nsIWindowsRegKey extends nsISupports {
    readonly ROOT_KEY_CLASSES_ROOT?: 2147483648;
    readonly ROOT_KEY_CURRENT_USER?: 2147483649;
    readonly ROOT_KEY_LOCAL_MACHINE?: 2147483650;
    readonly ACCESS_BASIC?: 131072;
    readonly ACCESS_QUERY_VALUE?: 1;
    readonly ACCESS_SET_VALUE?: 2;
    readonly ACCESS_CREATE_SUB_KEY?: 4;
    readonly ACCESS_ENUMERATE_SUB_KEYS?: 8;
    readonly ACCESS_NOTIFY?: 16;
    readonly ACCESS_READ?: 131097;
    readonly ACCESS_WRITE?: 131078;
    readonly ACCESS_ALL?: 131103;
    readonly WOW64_32?: 512;
    readonly WOW64_64?: 256;
    readonly TYPE_NONE?: 0;
    readonly TYPE_STRING?: 1;
    readonly TYPE_BINARY?: 3;
    readonly TYPE_INT?: 4;
    readonly TYPE_INT64?: 11;

    close(): void;
    open(rootKey: u32, relPath: string, mode: u32): void;
    create(rootKey: u32, relPath: string, mode: u32): void;
    openChild(relPath: string, mode: u32): nsIWindowsRegKey;
    createChild(relPath: string, mode: u32): nsIWindowsRegKey;
    readonly childCount: u32;
    getChildName(index: u32): string;
    hasChild(name: string): boolean;
    readonly valueCount: u32;
    getValueName(index: u32): string;
    hasValue(name: string): boolean;
    removeChild(relPath: string): void;
    removeValue(name: string): void;
    getValueType(name: string): u32;
    readStringValue(name: string): string;
    readIntValue(name: string): u32;
    readInt64Value(name: string): u64;
    readBinaryValue(name: string): string;
    writeStringValue(name: string, data: string): void;
    writeIntValue(name: string, data: u32): void;
    writeInt64Value(name: string, data: u64): void;
    writeBinaryValue(name: string, data: string): void;
  }

  // https://searchfox.org/mozilla-central/source/toolkit/xre/nsIWinAppHelper.idl

  interface nsIWinAppHelper extends nsISupports {
    readonly userCanElevate: boolean;
  }

  interface nsIXPCComponents_Interfaces {
    nsIInstalledApplication: nsJSIID<nsIInstalledApplication>;
    nsIAboutThirdParty: nsJSIID<nsIAboutThirdParty>;
    nsIAboutWindowsMessages: nsJSIID<nsIAboutWindowsMessages>;
    nsIWindowsAlertNotification: nsJSIID<
      nsIWindowsAlertNotification,
      typeof nsIWindowsAlertNotification_ImagePlacement
    >;
    nsIWindowsAlertsService: nsJSIID<nsIWindowsAlertsService>;
    nsIDefaultAgent: nsJSIID<nsIDefaultAgent>;
    nsIWindowsMutex: nsJSIID<nsIWindowsMutex>;
    nsIWindowsMutexFactory: nsJSIID<nsIWindowsMutexFactory>;
    nsIGeolocationUIUtilsWin: nsJSIID<nsIGeolocationUIUtilsWin>;
    nsIWindowsShellService: nsJSIID<
      nsIWindowsShellService,
      typeof nsIWindowsShellService_LaunchOnLoginEnabledEnumerator
    >;
    nsIWinTaskSchedulerService: nsJSIID<nsIWinTaskSchedulerService>;
    nsIJumpListBuilder: nsJSIID<nsIJumpListBuilder>;
    nsITaskbarOverlayIconController: nsJSIID<nsITaskbarOverlayIconController>;
    nsITaskbarPreview: nsJSIID<nsITaskbarPreview>;
    nsITaskbarPreviewButton: nsJSIID<nsITaskbarPreviewButton>;
    nsITaskbarPreviewCallback: nsJSIID<nsITaskbarPreviewCallback>;
    nsITaskbarPreviewController: nsJSIID<nsITaskbarPreviewController>;
    nsITaskbarProgress: nsJSIID<nsITaskbarProgress>;
    nsITaskbarTabPreview: nsJSIID<nsITaskbarTabPreview>;
    nsITaskbarWindowPreview: nsJSIID<nsITaskbarWindowPreview>;
    nsIWinTaskbar: nsJSIID<nsIWinTaskbar>;
    nsIWindowsUIUtils: nsJSIID<nsIWindowsUIUtils>;
    nsIWindowsPackageManager: nsJSIID<nsIWindowsPackageManager>;
    nsIWindowsRegKey: nsJSIID<nsIWindowsRegKey>;
    nsIWinAppHelper: nsJSIID<nsIWinAppHelper>;
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
