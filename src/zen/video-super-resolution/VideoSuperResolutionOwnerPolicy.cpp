/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "VideoSuperResolutionOwnerPolicy.h"

namespace mozilla::zen {

bool VideoSuperResolutionOwnerPolicy::ShouldTakeOwnership(
    const SuperResolutionOwnerCandidate& aChallenger,
    const SuperResolutionOwnerCandidate* aCurrentOwner,
    SuperResolutionHandoffReason* aOutReason) {
  if (aOutReason) {
    *aOutReason = SuperResolutionHandoffReason::None;
  }

  if (!aChallenger.eligible || !aChallenger.hasPresentationArea) {
    return false;
  }

  if (!aCurrentOwner || aCurrentOwner->pipelineId == 0) {
    if (aOutReason) {
      *aOutReason = SuperResolutionHandoffReason::ClaimInitial;
    }
    return true;
  }

  if (aChallenger.pipelineId == aCurrentOwner->pipelineId) {
    return true;
  }

  if (!aCurrentOwner->eligible) {
    if (aOutReason) {
      *aOutReason = SuperResolutionHandoffReason::OwnerIneligible;
    }
    return true;
  }

  if (!aCurrentOwner->hasPresentationArea ||
      aCurrentOwner->presentationArea == 0) {
    if (aOutReason) {
      *aOutReason = SuperResolutionHandoffReason::OwnerNoPresentationArea;
    }
    return true;
  }

  const double requiredArea =
      double(aCurrentOwner->presentationArea) * double(kAreaHysteresisRatio);
  if (double(aChallenger.presentationArea) >= requiredArea) {
    if (aOutReason) {
      *aOutReason = SuperResolutionHandoffReason::ChallengerAreaHysteresis;
    }
    return true;
  }

  return false;
}

}  // namespace mozilla::zen
