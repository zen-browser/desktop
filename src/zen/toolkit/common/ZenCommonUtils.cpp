/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenCommonUtils.h"
#include "ZenShareInternal.h"

#include "nsGlobalWindowOuter.h"
#include "nsQueryObject.h"
#include "nsIWindowMediator.h"
#include "nsServiceManagerUtils.h"
#include "nsISharePicker.h"

#include "mozilla/ClearOnShutdown.h"
#include "mozilla/StaticPrefs_zen.h"
#include "mozilla/StaticPtr.h"
#include "nsTHashMap.h"

#if defined(XP_WIN)
#  include "mozilla/WindowsVersion.h"
#endif

namespace zen {

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(ZenCommonUtils, nsIZenCommonUtils)
using WindowGlobalChild = mozilla::dom::WindowGlobalChild;

namespace {
/**
 * @brief Helper function to fetch the most recent window proxy.
 * @param aWindow The window to query.
 * @returns The most recent window.
 */
static nsresult GetMostRecentWindowProxy(mozIDOMWindowProxy** aWindow) {
  nsresult rv;
  nsCOMPtr<nsIWindowMediator> med(
      do_GetService(NS_WINDOWMEDIATOR_CONTRACTID, &rv));
  if (NS_FAILED(rv)) return rv;

  if (med) return med->GetMostRecentBrowserWindow(aWindow);

  return NS_ERROR_FAILURE;
}
/**
 * @brief Helper function to query and get a reference to the window.
 * @param aWindow The window to query.
 */
static nsCOMPtr<mozIDOMWindowProxy> GetMostRecentWindow() {
  nsCOMPtr<mozIDOMWindowProxy> aWindow;
  nsresult rv = GetMostRecentWindowProxy(getter_AddRefs(aWindow));
  if (NS_FAILED(rv) || !aWindow) {
    return nullptr;
  }
  return aWindow;
}

// Keyed by the browserId a tab capture was started with, main thread only.
static mozilla::StaticAutoPtr<nsTHashMap<nsUint64HashKey, uint64_t>>
    sTabCaptureTargets;
}  // namespace

using mozilla::dom::WindowGlobalChild;

#define NS_ZEN_CAN_SHARE_FAILURE() \
  *canShare = false;               \
  return NS_OK;

NS_IMETHODIMP
ZenCommonUtils::PlayHapticFeedback() {
  // We don't have any haptic feedback on non-macOS platforms
  // so we can just return.
  if (!mozilla::StaticPrefs::zen_haptic_feedback_enabled()) {
    return NS_OK;
  }
  return PlayHapticFeedbackInternal();
}

NS_IMETHODIMP
ZenCommonUtils::CanShare(bool* canShare) {
  auto aWindow = GetMostRecentWindow();
  if (!aWindow) {
    NS_ZEN_CAN_SHARE_FAILURE();
  }
  *canShare = IsSharingSupported();
  return NS_OK;
}

NS_IMETHODIMP
ZenCommonUtils::Share(nsIURI* url, const nsACString& title,
                      const nsACString& text, uint32_t aX, uint32_t aY,
                      uint32_t aWidth, uint32_t aHeight) {
  auto aWindow = GetMostRecentWindow();
  if (!aWindow) {
    return NS_ERROR_NOT_AVAILABLE;
  }
  if (!IsSharingSupported()) {
    return NS_OK;  // We don't want to throw an error here
  }
  return ShareInternal(aWindow, url, title, text, aX, aY, aWidth, aHeight);
}

nsresult ZenCommonUtils::ShareInternal(nsCOMPtr<mozIDOMWindowProxy>& aWindow,
                                       nsIURI* url, const nsACString& title,
                                       const nsACString& text, uint32_t aX,
                                       uint32_t aY, uint32_t aWidth,
                                       uint32_t aHeight) {
  // We shoud've had done pointer checks before, so we can assume
  // aWindow is valid.
#ifdef NS_ZEN_CAN_SHARE_NATIVE
  return ::nsZenNativeShareInternal::ShowNativeDialog(aWindow, url, title, text,
                                                      aX, aY, aWidth, aHeight);
#else
  return NS_ERROR_NOT_IMPLEMENTED;
#endif
}

auto ZenCommonUtils::IsSharingSupported() -> bool {
#if defined(XP_WIN) && !defined(__MINGW32__)
  // The first public build that supports ShareCanceled API
  return mozilla::IsWindows10BuildOrLater(18956);
#elif defined(NS_ZEN_CAN_SHARE_NATIVE)
  return NS_ZEN_CAN_SHARE_NATIVE;
#else
  return false;
#endif
}

NS_IMETHODIMP
ZenCommonUtils::SetTabCaptureTarget(uint64_t aCapturedBrowserId,
                                    uint64_t aTargetBrowserId) {
  MOZ_ASSERT(NS_IsMainThread());
  if (aCapturedBrowserId == aTargetBrowserId) {
    if (sTabCaptureTargets) {
      sTabCaptureTargets->Remove(aCapturedBrowserId);
    }
    return NS_OK;
  }
  if (!sTabCaptureTargets) {
    sTabCaptureTargets = new nsTHashMap<nsUint64HashKey, uint64_t>();
    mozilla::ClearOnShutdown(&sTabCaptureTargets);
  }
  sTabCaptureTargets->InsertOrUpdate(aCapturedBrowserId, aTargetBrowserId);
  return NS_OK;
}

auto ZenCommonUtils::ResolveTabCaptureTarget(uint64_t aCapturedBrowserId)
    -> uint64_t {
  MOZ_ASSERT(NS_IsMainThread());
  if (!sTabCaptureTargets) {
    return aCapturedBrowserId;
  }
  return sTabCaptureTargets->MaybeGet(aCapturedBrowserId)
      .valueOr(aCapturedBrowserId);
}

}  // namespace zen
