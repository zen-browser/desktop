/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <gtest/gtest.h>
#include <gmock/gmock.h>

#include <cstdint>
#include <windows.h>
#include <ole2.h>
#include <uiautomation.h>

#include "WindowsDefaultBrowser.h"
#include "WindowsDefaultBrowserTests.h"
#include "WindowsUIElement.h"
#include "mozilla/RefPtr.h"
#include "mozilla/SpinEventLoopUntil.h"
#include "mozilla/WindowsVersion.h"
#include "mozilla/gtest/MozAssertions.h"
#include "nsCOMPtr.h"
#include "nsISerialEventTarget.h"
#include "nsITimer.h"
#include "nsLiteralString.h"
#include "nsThreadUtils.h"

static bool IsElementFocus(const UIElement& aElement) {
  BOOL isFocus{FALSE};
  aElement->get_CurrentHasKeyboardFocus(&isFocus);
  return isFocus;
}

class WindowsUIElementTests : public FindSetDefaultBrowserButtonTests {};

TEST_F(WindowsUIElementTests, DefaultBrowserButtonFocused) {
  ASSERT_TRUE(LaunchModernSettingsDialogDefaultApps());

  auto [window, button]{WaitForSetDefaultBrowserButton()};
  ASSERT_THAT(window, testing::NotNull());
  ASSERT_THAT(button, testing::NotNull());

  RefPtr<mozilla::WindowsUIElement> element{
      new mozilla::WindowsUIElement(window, button)};
  element->Focus();

  ASSERT_TRUE(IsElementFocus(button));
}

TEST_F(WindowsUIElementTests, DefaultBrowserButtonStopsMoving) {
  if (!mozilla::IsWin11OrLater()) {
    // This test is intended to run only on Win11 since it's part of the feature
    // that displays the Kit image behind the Set Default Browser button
    return;
  }

  ASSERT_TRUE(LaunchModernSettingsDialogDefaultApps());

  auto [window, button]{WaitForSetDefaultBrowserButton()};
  ASSERT_THAT(window, testing::NotNull());
  ASSERT_THAT(button, testing::NotNull());

  RefPtr<mozilla::WindowsUIElement> element{
      new mozilla::WindowsUIElement(window, button)};

  nsCOMPtr<nsISerialEventTarget> queue;
  ASSERT_NS_SUCCEEDED(NS_CreateBackgroundTaskQueue(
      "WindowsUIElementTests::DefaultBrowserButtonStopsMovingQueue",
      getter_AddRefs(queue)));

  int ticks{0};
  bool elementIsMoving{true};
  bool done{false};
  nsCOMPtr<nsITimer> timer;
  auto callback{[element, &ticks, &elementIsMoving, &done](nsITimer* aTimer) {
    elementIsMoving = element->IsMoving().valueOr(true);
    constexpr int kMaxTicks{10};
    if (!elementIsMoving || ++ticks >= kMaxTicks) {
      aTimer->Cancel();
      NS_DispatchToMainThread(NS_NewRunnableFunction(
          "WindowsUIElementTests::DefaultBrowserButtonStopsMovingDone",
          [&done] { done = true; }));
    }
  }};

  const uint32_t kDelayMs{500};
  ASSERT_NS_SUCCEEDED(NS_NewTimerWithCallback(
      getter_AddRefs(timer), callback, kDelayMs, nsITimer::TYPE_REPEATING_SLACK,
      "WindowsUIElementTests::DefaultBrowserButtonStopsMovingTimer"_ns, queue));

  mozilla::SpinEventLoopUntil(
      "WindowsUIElementTests::DefaultBrowserButtonStopsMovingLoop"_ns,
      [&done] { return bool(done); });

  ASSERT_FALSE(elementIsMoving);
}
