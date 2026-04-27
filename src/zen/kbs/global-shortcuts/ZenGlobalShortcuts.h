/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenGlobalShortcuts_h_
#define mozilla_ZenGlobalShortcuts_h_

#include "nsIZenGlobalShortcuts.h"

#include "nsCOMPtr.h"
#include "nsString.h"
#include "nsTArray.h"

namespace zen {

/**
 * @brief Singleton XPCOM service that registers OS-level global hotkeys
 * and dispatches a trusted DOM event on the most recently focused
 * browser window when one fires.
 */
class ZenGlobalShortcuts final : public nsIZenGlobalShortcuts {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENGLOBALSHORTCUTS

  ZenGlobalShortcuts();

  // Per-shortcut record. Public so the per-OS backend can read/write its
  // fields directly without going through accessors.
  struct Registration {
    nsCString id;
    uint32_t internalId = 0;
    void* nativeHandle = nullptr;
  };

  // Called by the per-OS layer when a registered shortcut is triggered
  // by the system. Safe to call from any thread; bounces to the main
  // thread before touching DOM state.
  static void OnNativeShortcut(uint32_t aInternalId);

 private:
  ~ZenGlobalShortcuts();

  static ZenGlobalShortcuts* sInstance;

  const Registration* FindByInternalId(uint32_t aInternalId) const;
  static void DispatchEventForId(const nsACString& aId);

  // Per-OS implementations live in cocoa/, windows/, or the stub.
  static nsresult NativeRegister(Registration& aReg, const nsACString& aKey,
                                 uint32_t aModifiers);
  static void NativeUnregister(Registration& aReg);
  static void NativeShutdown();

  nsTArray<Registration> mRegistrations;
  uint32_t mNextInternalId = 1;
};

}  // namespace zen

#endif
