// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from services.json.
 * If you're updating some of the sources, see README for instructions.
 */

interface JSServices {
  DAPTelemetry: nsIDAPTelemetry;
  appShell: nsIAppShellService;
  appinfo: nsICrashReporter & nsIXULAppInfo & nsIXULRuntime;
  blocklist: nsIBlocklistService;
  cache2: nsICacheStorageService;
  catMan: nsICategoryManager;
  clearData: nsIClearDataService;
  clipboard: nsIClipboard;
  console: nsIConsoleService;
  cookieBanners: nsICookieBannerService;
  cookies: nsICookieManager & nsICookieService;
  cpmm: ContentProcessMessageManager;
  dirsvc: nsIDirectoryService & nsIProperties;
  dns: nsIDNSService;
  domStorageManager: nsIDOMStorageManager & nsILocalStorageManager;
  droppedLinkHandler: nsIDroppedLinkHandler;
  eTLD: nsIEffectiveTLDService;
  els: nsIEventListenerService;
  env: nsIEnvironment;
  focus: nsIFocusManager;
  fog: nsIFOG;
  intl: mozIMozIntl;
  io: nsIIOService & nsINetUtil & nsISpeculativeConnect;
  loadContextInfo: nsILoadContextInfoFactory;
  locale: mozILocaleService;
  logins: nsILoginManager;
  mm: ChromeMessageBroadcaster;
  obs: nsIObserverService;
  perms: nsIPermissionManager;
  policies: nsIEnterprisePolicies;
  ppmm: ParentProcessMessageManager;
  prefs: nsIPrefBranch & nsIPrefService;
  profiler: nsIProfiler;
  prompt: nsIPromptService;
  qms: nsIQuotaManagerService;
  rfp: nsIRFPService;
  scriptSecurityManager: nsIScriptSecurityManager;
  scriptloader: mozIJSSubScriptLoader;
  search: nsISearchService;
  sessionStorage: nsISessionStorageService;
  startup: nsIAppStartup;
  storage: mozIStorageService;
  strings: nsIStringBundleService;
  sysinfo: nsIPropertyBag2 & nsISystemInfo;
  telemetry: nsITelemetry;
  textToSubURI: nsITextToSubURI;
  tm: nsIThreadManager;
  uriFixup: nsIURIFixup;
  urlFormatter: nsIURLFormatter;
  uuid: nsIUUIDGenerator;
  vc: nsIVersionComparator;
  wm: nsIWindowMediator;
  ww: nsIWindowWatcher;
  xulStore: nsIXULStore;
}
