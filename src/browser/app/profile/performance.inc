// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#ifdef XP_MACOSX
  // Pref to control the reponse taken on macOS when the OS is under memory
  // pressure. Changes to the pref take effect immediately. Browser restart not
  // required. The pref value is a bitmask:
  // 0x0: No response (other than recording for telemetry, crash reporting)
  // 0x1: Use the tab unloading feature to reduce memory use. Requires that
  //      the above "browser.tabs.unloadOnLowMemory" pref be set to true for tab
  //      unloading to occur.
  // 0x2: Issue the internal "memory-pressure" notification to reduce memory use
  // 0x3: Both 0x1 and 0x2.
  pref("browser.lowMemoryResponseMask", 3);
#endif

pref("network.predictor.enable-hover-on-ssl", true);
