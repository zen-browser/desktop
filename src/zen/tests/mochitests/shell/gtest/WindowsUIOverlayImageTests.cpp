/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <gtest/gtest.h>
#include <gmock/gmock.h>

#include <cstdint>
#include <vector>
#include <windows.h>

#include "WindowsUIOverlayImage.h"
#include "WindowsDefaultBrowser.h"
#include "WindowsDefaultBrowserTests.h"
#include "WindowsUIElement.h"
#include "mozilla/RefPtr.h"
#include "mozilla/SpinEventLoopUntil.h"
#include "mozilla/SyncRunnable.h"
#include "mozilla/WindowsVersion.h"
#include "mozilla/gtest/MozAssertions.h"
#include "nsCOMPtr.h"
#include "nsISerialEventTarget.h"
#include "nsISupportsImpl.h"
#include "nsITimer.h"
#include "nsLiteralString.h"
#include "nsThreadUtils.h"

namespace {

class CoverWindow final {
 public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(CoverWindow)

  static RefPtr<CoverWindow> Create(HWND aWindow) {
    RECT rect{};
    if (!GetWindowRect(aWindow, &rect)) {
      return nullptr;
    }

    constexpr LPCWSTR kWindowClassName{L"CoverWindow"};
    WNDCLASSEXW windowClass{sizeof(windowClass)};
    windowClass.lpfnWndProc = DefWindowProcW;
    windowClass.hInstance = GetModuleHandleW(nullptr);
    windowClass.lpszClassName = kWindowClassName;
    RegisterClassExW(&windowClass);

    HWND window{nullptr};
    mozilla::SyncRunnable::DispatchToThread(
        mozilla::GetMainThreadSerialEventTarget(),
        NS_NewRunnableFunction("CoverWindow::Create", [&window, rect] {
          window = CreateWindowExW(
              WS_EX_TOPMOST, kWindowClassName, nullptr, WS_POPUP, rect.left,
              rect.top, rect.right - rect.left, rect.bottom - rect.top, nullptr,
              nullptr, GetModuleHandleW(nullptr), nullptr);
        }));
    if (!window) {
      return nullptr;
    }

    ShowWindow(window, SW_SHOWNOACTIVATE);

    return RefPtr<CoverWindow>{new CoverWindow(window)};
  }

  // Non-copyable and non-movable
  CoverWindow(const CoverWindow&) = delete;
  CoverWindow(CoverWindow&&) = delete;
  CoverWindow& operator=(const CoverWindow&) = delete;
  CoverWindow& operator=(CoverWindow&&) = delete;

 private:
  explicit CoverWindow(HWND aWindow) : mWindow{aWindow} {}

  ~CoverWindow() {
    if (mWindow) {
      NS_DispatchToMainThread(NS_NewRunnableFunction(
          "CoverWindow::DestroyWindow",
          [window = mWindow] { DestroyWindow(window); }));
      mWindow = nullptr;
    }
  }

  HWND mWindow;
};

}  // namespace

class WindowsUIOverlayImageTests : public FindSetDefaultBrowserButtonTests {};

TEST_F(WindowsUIOverlayImageTests, OverlayHiddenWhenCovered) {
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
      "WindowsUIOverlayImageTests::OverlayHiddenWhenCoveredQueue",
      getter_AddRefs(queue)));

  bool elementIsMoving{true};
  RefPtr<mozilla::WindowsUIOverlayImage> overlayImage;
  bool overlayImageIsVisibleBefore{false};
  RefPtr<CoverWindow> coverWindow;
  bool overlayImageIsVisibleAfter{true};
  bool done{false};
  int ticks{0};
  int state{0};
  nsCOMPtr<nsITimer> timer;
  auto callback{[element, &elementIsMoving, &overlayImage,
                 &overlayImageIsVisibleBefore, window, &coverWindow,
                 &overlayImageIsVisibleAfter, &done, &ticks,
                 &state](nsITimer* aTimer) {
    bool finished{false};
    switch (state) {
      case 0:
        // Wait until the element stops moving
        elementIsMoving = element->IsMoving().valueOr(true);
        if (!elementIsMoving) {
          ++state;
        }
        break;
      case 1:
        // Create the overlay image
        overlayImage = element->CreateOverlayImage(
            mozilla::WindowsUIOverlayImage::DisplayMode::Static);
        finished = !overlayImage;
        ++state;
        break;
      case 2:
        // The overlay image is visible before anything covers it
        overlayImageIsVisibleBefore = overlayImage->IsVisible();
        if (overlayImageIsVisibleBefore) {
          ++state;
        }
        break;
      case 3:
        // Cover the Windows Settings window
        coverWindow = CoverWindow::Create(window);
        finished = !coverWindow;
        ++state;
        break;
      case 4:
        // The overlay image shouldn't be visible
        overlayImageIsVisibleAfter = overlayImage->IsVisible();
        finished = true;
        break;
    }

    constexpr int kMaxTicks{40};
    if (finished || ++ticks >= kMaxTicks) {
      aTimer->Cancel();
      NS_DispatchToMainThread(NS_NewRunnableFunction(
          "WindowsUIOverlayImageTests::OverlayHiddenWhenCoveredDone",
          [&done] { done = true; }));
    }
  }};

  const uint32_t kDelayMs{500};
  ASSERT_NS_SUCCEEDED(NS_NewTimerWithCallback(
      getter_AddRefs(timer), callback, kDelayMs, nsITimer::TYPE_REPEATING_SLACK,
      "WindowsUIOverlayImageTests::OverlayHiddenWhenCoveredTimer"_ns, queue));

  mozilla::SpinEventLoopUntil(
      "WindowsUIOverlayImageTests::OverlayHiddenWhenCoveredLoop"_ns,
      [&done] { return bool(done); });

  ASSERT_FALSE(elementIsMoving);
  ASSERT_THAT(overlayImage, testing::NotNull());
  ASSERT_TRUE(overlayImageIsVisibleBefore);
  ASSERT_THAT(coverWindow, testing::NotNull());
  ASSERT_FALSE(overlayImageIsVisibleAfter);
}

TEST(GetFrameDurationTests, KitImageFirstFrameDurationIs40ms)
{
  nsCOMPtr<nsIFile> imageFile{mozilla::GetImageFile()};
  ASSERT_THAT(imageFile, testing::NotNull());

  RefPtr<IWICImagingFactory> factory{mozilla::CreateWICImagingFactory()};
  ASSERT_THAT(factory, testing::NotNull());

  RefPtr<IWICBitmapDecoder> decoder{
      mozilla::CreateWICBitmapDecoder(factory, imageFile)};
  ASSERT_THAT(decoder, testing::NotNull());

  RefPtr<IWICBitmapFrameDecode> frame;
  constexpr UINT kFrameNumber{0};
  ASSERT_TRUE(
      SUCCEEDED(decoder->GetFrame(kFrameNumber, getter_AddRefs(frame))));

  const mozilla::TimeDuration kSentinelFrameDuration{
      mozilla::TimeDuration::FromMilliseconds(999)};
  const mozilla::TimeDuration duration{
      mozilla::GetFrameDuration(frame, kSentinelFrameDuration)};

  // Kit image (kit.gif) frame duration is 40 ms
  const mozilla::TimeDuration kFrameDuration{
      mozilla::TimeDuration::FromMilliseconds(40)};

  EXPECT_EQ(duration, kFrameDuration);
}

class ComputeAdvancedFrameTests : public testing::Test {
 protected:
  const mozilla::TimeDuration mFrameDuration{
      mozilla::TimeDuration::FromMilliseconds(25)};

  const std::vector<mozilla::WindowsUIOverlayImage::Frame> mFrames{
      4, mozilla::WindowsUIOverlayImage::Frame{{}, mFrameDuration}};
};

TEST_F(ComputeAdvancedFrameTests, DoesNotAdvanceWhenTimeBelowFrameDuration) {
  mozilla::TimeDuration accumulated{
      mozilla::TimeDuration::FromMilliseconds(20)};

  size_t frame{mozilla::ComputeAdvancedFrame(mFrames, 0, accumulated)};

  EXPECT_EQ(frame, 0u);
  EXPECT_EQ(accumulated, mozilla::TimeDuration::FromMilliseconds(20));
}

TEST_F(ComputeAdvancedFrameTests, AdvancesSingleFrame) {
  mozilla::TimeDuration accumulated{
      mozilla::TimeDuration::FromMilliseconds(30)};

  size_t frame{mozilla::ComputeAdvancedFrame(mFrames, 0, accumulated)};

  EXPECT_EQ(frame, 1u);
  EXPECT_EQ(accumulated,
            mozilla::TimeDuration::FromMilliseconds(30) - mFrameDuration);
}

TEST_F(ComputeAdvancedFrameTests, AdvancesMultipleFramesInOneCall) {
  mozilla::TimeDuration accumulated{
      mozilla::TimeDuration::FromMilliseconds(60)};

  size_t frame{mozilla::ComputeAdvancedFrame(mFrames, 0, accumulated)};

  EXPECT_EQ(frame, 2u);
  EXPECT_EQ(accumulated,
            mozilla::TimeDuration::FromMilliseconds(60) - mFrameDuration * 2);
}

TEST_F(ComputeAdvancedFrameTests, DoesNotAdvancePastLastFrame) {
  mozilla::TimeDuration accumulated{
      mozilla::TimeDuration::FromMilliseconds(1000)};

  size_t frame{mozilla::ComputeAdvancedFrame(mFrames, 0, accumulated)};

  EXPECT_EQ(frame, 3u);
  // The time for the frames not reached is left untouched
  EXPECT_EQ(accumulated,
            mozilla::TimeDuration::FromMilliseconds(1000) - mFrameDuration * 3);
}

TEST_F(ComputeAdvancedFrameTests, StaysOnLastFrame) {
  mozilla::TimeDuration accumulated{
      mozilla::TimeDuration::FromMilliseconds(1000)};

  size_t frame{mozilla::ComputeAdvancedFrame(mFrames, 3, accumulated)};

  EXPECT_EQ(frame, 3u);
  EXPECT_EQ(accumulated, mozilla::TimeDuration::FromMilliseconds(1000));
}
