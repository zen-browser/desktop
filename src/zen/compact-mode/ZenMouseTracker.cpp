/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenMouseTracker.h"
#include "ZenMouseTrackerInternal.h"

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
  MOZ_ASSERT(NS_IsMainThread());
  const auto edge = ParseEdge(aScreenEdge);
  if (!aWindow || edge.isNothing() || aMaxEdgeOffset < 0.0f) {
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

  for (auto& tracked : mTracked) {
    if (tracked.mWindow == window) {
      tracked.mEdge = *edge;
      tracked.mMaxEdgeOffset = aMaxEdgeOffset;
      return NS_OK;
    }
  }
  mTracked.AppendElement(TrackedWindow{window, *edge, aMaxEdgeOffset});
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
  for (size_t i = mTracked.Length(); i > 0; i--) {
    auto& tracked = mTracked[i - 1];
    RefPtr<nsIWidget> widget =
        mozilla::widget::WidgetUtils::DOMWindowToWidget(tracked.mWindow);
    if (!widget) {
      mTracked.RemoveElementAt(i - 1);
      continue;
    }
    if (!IsPointerWithinBounds(tracked, aPoint, widget)) {
      exited.AppendElement(std::move(tracked.mWindow));
      mTracked.RemoveElementAt(i - 1);
    }
  }
  OnTrackedListChanged();

  if (exited.IsEmpty()) {
    return;
  }
  nsCOMPtr<nsIObserverService> obs = mozilla::services::GetObserverService();
  if (!obs) {
    return;
  }
  for (auto& window : exited) {
    obs->NotifyObservers(window, ZEN_MOUSE_TRACKER_EXITED_TOPIC, nullptr);
  }
}

// static
bool ZenMouseTracker::IsPointerWithinBounds(const TrackedWindow& aTracked,
                                            const mozilla::DesktopPoint& aPoint,
                                            nsIWidget* aWidget) {
  const auto scale = aWidget->GetDesktopToDeviceScale();
  const float x = aPoint.x * scale.scale;
  const float y = aPoint.y * scale.scale;

  const auto origin = aWidget->WidgetToScreenOffset();
  const auto size = aWidget->GetClientSize();
  const float left = origin.x;
  const float top = origin.y;
  const float right = left + size.width;
  const float bottom = top + size.height;

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
