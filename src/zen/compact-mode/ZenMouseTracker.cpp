/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenMouseTracker.h"
#include "ZenMouseTrackerInternal.h"

#include <algorithm>
#include <atomic>

#include "mozilla/Services.h"
#include "mozilla/WidgetUtils.h"
#include "nsIObserverService.h"
#include "nsIWidget.h"
#include "nsThreadUtils.h"

namespace zen {

NS_IMPL_ISUPPORTS(ZenMouseTracker, nsIZenMouseTracker, nsIObserver)

static ZenMouseTracker* sInstance = nullptr;

// Pointer moves are coalesced: the backends may report them faster than we
// want to run the checks, and on Windows they arrive from a low level hook
// where as little work as possible should happen. These are atomic since
// some backends (e.g. the macOS global event monitor) may deliver the moves
// off the main thread.
static std::atomic<int32_t> sLatestPointerX{0};
static std::atomic<int32_t> sLatestPointerY{0};
static std::atomic<bool> sPendingEvaluation{false};

ZenMouseTracker::ZenMouseTracker() {
  MOZ_ASSERT(NS_IsMainThread());
  sInstance = this;
}

ZenMouseTracker::~ZenMouseTracker() {
  ZenNativeMouseMonitor::Stop();
  if (sInstance == this) {
    sInstance = nullptr;
  }
}

// static
mozilla::Maybe<ZenMouseTracker::TrackedEdge> ZenMouseTracker::ParseEdge(
    const nsACString& aScreenEdge) {
  if (aScreenEdge.EqualsLiteral("left")) {
    return mozilla::Some(TrackedEdge::Left);
  }
  if (aScreenEdge.EqualsLiteral("right")) {
    return mozilla::Some(TrackedEdge::Right);
  }
  if (aScreenEdge.EqualsLiteral("top")) {
    return mozilla::Some(TrackedEdge::Top);
  }
  if (aScreenEdge.EqualsLiteral("bottom")) {
    return mozilla::Some(TrackedEdge::Bottom);
  }
  return mozilla::Nothing();
}

NS_IMETHODIMP
ZenMouseTracker::RegisterWindow(mozIDOMWindowProxy* aWindow,
                                const nsACString& aScreenEdge,
                                float aMaxEdgeOffset) {
  const auto edge = ParseEdge(aScreenEdge);
  if (edge.isNothing() || aMaxEdgeOffset < 0.0f) {
    return NS_ERROR_INVALID_ARG;
  }
  return Track(aWindow, TrackedWindow{nullptr, Mode::Hold, *edge,
                                      aMaxEdgeOffset, 0.0f, 0.0f});
}

NS_IMETHODIMP
ZenMouseTracker::WatchEdgeApproach(mozIDOMWindowProxy* aWindow,
                                   const nsACString& aScreenEdge,
                                   float aStripWidth, float aBandWidth) {
#ifdef XP_WIN
  const auto edge = ParseEdge(aScreenEdge);
  if (!aWindow || edge.isNothing() || aStripWidth < 0.0f ||
      aBandWidth <= aStripWidth) {
    return NS_ERROR_INVALID_ARG;
  }
  // The hook delays every pointer move on the system, so it only goes in
  // while a foreign border covers the edge level with the pointer
  RefPtr<nsIWidget> widget = mozilla::widget::WidgetUtils::DOMWindowToWidget(
      nsPIDOMWindowOuter::From(aWindow));
  int32_t x, y;
  if (!widget || !ZenNativeMouseMonitor::GetCursorPosition(&x, &y) ||
      !IsEdgeCovered(*edge, mozilla::DesktopPoint(float(x), float(y)),
                     widget)) {
    return NS_OK;
  }
  return Track(aWindow, TrackedWindow{nullptr, Mode::Approach, *edge, 0.0f,
                                      aStripWidth, aBandWidth});
#else
  return NS_ERROR_NOT_AVAILABLE;
#endif
}

nsresult ZenMouseTracker::Track(mozIDOMWindowProxy* aWindow,
                                TrackedWindow aTracked) {
  MOZ_ASSERT(NS_IsMainThread());
  if (!aWindow) {
    return NS_ERROR_INVALID_ARG;
  }
  nsCOMPtr<nsPIDOMWindowOuter> window = nsPIDOMWindowOuter::From(aWindow);
  if (!window) {
    return NS_ERROR_INVALID_ARG;
  }

  nsresult rv = ZenNativeMouseMonitor::Start();
  if (NS_FAILED(rv)) {
    return rv;
  }

  aTracked.mWindow = window;
  for (auto& tracked : mTracked) {
    if (tracked.mWindow == window) {
      tracked = std::move(aTracked);
      return NS_OK;
    }
  }
  mTracked.AppendElement(std::move(aTracked));
  AddObservers();
  return NS_OK;
}

void ZenMouseTracker::AddObservers() {
  if (mObserving) {
    return;
  }
  if (nsCOMPtr<nsIObserverService> obs =
          mozilla::services::GetObserverService()) {
    obs->AddObserver(this, "domwindowclosed", false);
    obs->AddObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID, false);
    mObserving = true;
  }
}

void ZenMouseTracker::RemoveObservers() {
  if (!mObserving) {
    return;
  }
  if (nsCOMPtr<nsIObserverService> obs =
          mozilla::services::GetObserverService()) {
    obs->RemoveObserver(this, "domwindowclosed");
    obs->RemoveObserver(this, NS_XPCOM_SHUTDOWN_OBSERVER_ID);
  }
  mObserving = false;
}

NS_IMETHODIMP
ZenMouseTracker::UnregisterWindow(mozIDOMWindowProxy* aWindow) {
  MOZ_ASSERT(NS_IsMainThread());
  if (!aWindow) {
    return NS_ERROR_INVALID_ARG;
  }
  StopTrackingWindow(nsPIDOMWindowOuter::From(aWindow));
  return NS_OK;
}

void ZenMouseTracker::StopTrackingWindow(nsPIDOMWindowOuter* aWindow) {
  for (size_t i = 0; i < mTracked.Length(); i++) {
    if (mTracked[i].mWindow == aWindow) {
      mTracked.RemoveElementAt(i);
      break;
    }
  }
  OnTrackedListChanged();
}

void ZenMouseTracker::OnTrackedListChanged() {
  if (mTracked.IsEmpty()) {
    ZenNativeMouseMonitor::Stop();
    RemoveObservers();
  }
}

// static
void ZenMouseTracker::OnNativePointerMove(const mozilla::DesktopPoint& aPoint) {
  sLatestPointerX = int32_t(aPoint.x);
  sLatestPointerY = int32_t(aPoint.y);
  if (sPendingEvaluation.exchange(true)) {
    // An already queued evaluation will pick up the position we just stored
    return;
  }
  nsresult rv = NS_DispatchToMainThread(
      NS_NewRunnableFunction("zen::ZenMouseTracker::Evaluate", [] {
        sPendingEvaluation = false;
        if (RefPtr<ZenMouseTracker> tracker = sInstance) {
          tracker->Evaluate(mozilla::DesktopPoint(float(sLatestPointerX),
                                                  float(sLatestPointerY)));
        }
      }));
  if (NS_FAILED(rv)) {
    // Don't let a failed dispatch (e.g. during shutdown) block all future
    // evaluations
    sPendingEvaluation = false;
  }
}

void ZenMouseTracker::Evaluate(const mozilla::DesktopPoint& aPoint) {
  nsTArray<nsCOMPtr<nsPIDOMWindowOuter>> exited;
  nsTArray<nsCOMPtr<nsPIDOMWindowOuter>> reached;
  for (size_t i = mTracked.Length(); i > 0; i--) {
    auto& tracked = mTracked[i - 1];
    RefPtr<nsIWidget> widget =
        mozilla::widget::WidgetUtils::DOMWindowToWidget(tracked.mWindow);
    if (!widget) {
      mTracked.RemoveElementAt(i - 1);
      continue;
    }
    if (tracked.mMode == Mode::Hold) {
      if (!IsPointerWithinBounds(tracked, aPoint, widget)) {
        exited.AppendElement(std::move(tracked.mWindow));
        mTracked.RemoveElementAt(i - 1);
      }
      continue;
    }
    const Approach approach = EvaluateApproach(tracked, aPoint, widget);
    if (approach == Approach::Reached) {
      reached.AppendElement(std::move(tracked.mWindow));
    }
    if (approach != Approach::Watching) {
      mTracked.RemoveElementAt(i - 1);
    }
  }
  OnTrackedListChanged();

  if (exited.IsEmpty() && reached.IsEmpty()) {
    return;
  }
  nsCOMPtr<nsIObserverService> obs = mozilla::services::GetObserverService();
  if (!obs) {
    return;
  }
  for (auto& window : exited) {
    obs->NotifyObservers(window, ZEN_MOUSE_TRACKER_EXITED_TOPIC, nullptr);
  }
  for (auto& window : reached) {
    obs->NotifyObservers(window, ZEN_MOUSE_TRACKER_EDGE_REACHED_TOPIC, nullptr);
  }
}

// The pointer and the window's client area, in device pixels
struct DeviceGeometry {
  float x, y, left, top, right, bottom;
};

static DeviceGeometry GetDeviceGeometry(nsIWidget* aWidget,
                                        const mozilla::DesktopPoint& aPoint) {
  const auto scale = aWidget->GetDesktopToDeviceScale();
  const auto origin = aWidget->WidgetToScreenOffset();
  const auto size = aWidget->GetClientSize();
  return {aPoint.x * scale.scale,
          aPoint.y * scale.scale,
          float(origin.x),
          float(origin.y),
          float(origin.x + size.width),
          float(origin.y + size.height)};
}

// static
bool ZenMouseTracker::IsPointerWithinBounds(const TrackedWindow& aTracked,
                                            const mozilla::DesktopPoint& aPoint,
                                            nsIWidget* aWidget) {
  const auto [x, y, left, top, right, bottom] =
      GetDeviceGeometry(aWidget, aPoint);

  if (x >= left && x <= right && y >= top && y <= bottom) {
    // Back inside the window; the in-window hover logic owns this case
    return true;
  }

  const float maxOffset =
      aTracked.mMaxEdgeOffset * float(aWidget->GetDefaultScale().scale);
  switch (aTracked.mEdge) {
    case TrackedEdge::Left:
      return x >= left - maxOffset && x < left && y >= top && y <= bottom;
    case TrackedEdge::Right:
      return x > right && x <= right + maxOffset && y >= top && y <= bottom;
    case TrackedEdge::Top:
      return y >= top - maxOffset && y < top && x >= left && x <= right;
    case TrackedEdge::Bottom:
      return y > bottom && y <= bottom + maxOffset && x >= left && x <= right;
  }
  return false;
}

// static
ZenMouseTracker::Approach ZenMouseTracker::EvaluateApproach(
    const TrackedWindow& aTracked, const mozilla::DesktopPoint& aPoint,
    nsIWidget* aWidget) {
  const auto [x, y, left, top, right, bottom] =
      GetDeviceGeometry(aWidget, aPoint);

  // How far inside the window the pointer is (negative past the edge), and
  // the edge pixel it is on or headed for
  float inward = 0.0f;
  bool inSpan = false;
  float edgeX = x;
  float edgeY = y;
  switch (aTracked.mEdge) {
    case TrackedEdge::Left:
      inward = x - left;
      inSpan = y >= top && y < bottom;
      edgeX = std::max(x, left);
      break;
    case TrackedEdge::Right:
      inward = right - 1 - x;
      inSpan = y >= top && y < bottom;
      edgeX = std::min(x, right - 1);
      break;
    case TrackedEdge::Top:
      inward = y - top;
      inSpan = x >= left && x < right;
      edgeY = std::max(y, top);
      break;
    case TrackedEdge::Bottom:
      inward = bottom - 1 - y;
      inSpan = x >= left && x < right;
      edgeY = std::min(y, bottom - 1);
      break;
  }

  const float cssToDevice = float(aWidget->GetDefaultScale().scale);
  const float band = aTracked.mBandWidth * cssToDevice;
  if (!inSpan || inward >= band) {
    return Approach::Gone;
  }
  if (inward >= aTracked.mStripWidth * cssToDevice) {
    return Approach::Watching;
  }
  // Additional guard for a case where something pins the mouse to the desktop border
  if (ZenNativeMouseMonitor::IsCoveredByForeignBorder(aWidget, int32_t(edgeX),
                                                      int32_t(edgeY))) {
    return Approach::Reached;
  }
  return inward <= -band ? Approach::Gone : Approach::Watching;
}

// static
bool ZenMouseTracker::IsEdgeCovered(TrackedEdge aEdge,
                                    const mozilla::DesktopPoint& aPoint,
                                    nsIWidget* aWidget) {
  const auto [x, y, left, top, right, bottom] =
      GetDeviceGeometry(aWidget, aPoint);
  switch (aEdge) {
    case TrackedEdge::Left:
      return ZenNativeMouseMonitor::IsCoveredByForeignBorder(
          aWidget, int32_t(left), int32_t(y));
    case TrackedEdge::Right:
      return ZenNativeMouseMonitor::IsCoveredByForeignBorder(
          aWidget, int32_t(right - 1), int32_t(y));
    case TrackedEdge::Top:
      return ZenNativeMouseMonitor::IsCoveredByForeignBorder(
          aWidget, int32_t(x), int32_t(top));
    case TrackedEdge::Bottom:
      return ZenNativeMouseMonitor::IsCoveredByForeignBorder(
          aWidget, int32_t(x), int32_t(bottom - 1));
  }
  return false;
}

NS_IMETHODIMP
ZenMouseTracker::Observe(nsISupports* aSubject, const char* aTopic,
                         const char16_t* aData) {
  if (!strcmp(aTopic, "domwindowclosed")) {
    if (nsCOMPtr<nsPIDOMWindowOuter> window = do_QueryInterface(aSubject)) {
      StopTrackingWindow(window);
    }
    return NS_OK;
  }
  if (!strcmp(aTopic, NS_XPCOM_SHUTDOWN_OBSERVER_ID)) {
    mTracked.Clear();
    OnTrackedListChanged();
  }
  return NS_OK;
}

}  // namespace zen
