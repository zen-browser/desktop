/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/SwipeTracker.h"
#include "InputData.h"

#include "mozilla/StaticPrefs_widget.h"
#include "mozilla/TouchEvents.h"
#include "mozilla/dom/SimpleGestureEvent.h"

namespace mozilla {

bool SwipeTracker::HasConsumerThreshold() const {
  return mConsumerThreshold.isSome();
}

double SwipeTracker::SuccessVelocityContribution() const {
  return mConsumerVelocityContribution.valueOr(
      StaticPrefs::widget_swipe_success_velocity_contribution());
}

void SwipeTracker::ReadConsumerSwipeConfig(
    const WidgetSimpleGestureEvent& aEvent) {
  if (aEvent.mSwipeSuccessThreshold > 0.0) {
    mConsumerThreshold = Some(aEvent.mSwipeSuccessThreshold);
  }
  if (aEvent.mSwipeSuccessVelocityContribution >= 0.0) {
    mConsumerVelocityContribution =
        Some(aEvent.mSwipeSuccessVelocityContribution);
  }
}

namespace dom {

double SimpleGestureEvent::SwipeSuccessThreshold() const {
  return mEvent->AsSimpleGestureEvent()->mSwipeSuccessThreshold;
}

void SimpleGestureEvent::SetSwipeSuccessThreshold(
    double aSwipeSuccessThreshold) {
  mEvent->AsSimpleGestureEvent()->mSwipeSuccessThreshold =
      aSwipeSuccessThreshold;
}

double SimpleGestureEvent::SwipeSuccessVelocityContribution() const {
  return mEvent->AsSimpleGestureEvent()->mSwipeSuccessVelocityContribution;
}

void SimpleGestureEvent::SetSwipeSuccessVelocityContribution(
    double aSwipeSuccessVelocityContribution) {
  mEvent->AsSimpleGestureEvent()->mSwipeSuccessVelocityContribution =
      aSwipeSuccessVelocityContribution;
}

}  // namespace dom

}  // namespace mozilla
