/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_VideoSuperResolutionOwnerPolicy_h
#define mozilla_zen_VideoSuperResolutionOwnerPolicy_h

#include <cstdint>

namespace mozilla::zen {

struct SuperResolutionOwnerCandidate {
  uint64_t pipelineId = 0;
  bool eligible = false;
  bool hasPresentationArea = false;
  uint64_t presentationArea = 0;
};

enum class SuperResolutionHandoffReason {
  None,
  ClaimInitial,
  OwnerIneligible,
  OwnerNoPresentationArea,
  ChallengerAreaHysteresis,
  TieBreaker,
};

inline const char* SuperResolutionHandoffReasonToString(SuperResolutionHandoffReason aReason) {
  switch (aReason) {
    case SuperResolutionHandoffReason::None:
      return "none";
    case SuperResolutionHandoffReason::ClaimInitial:
      return "claim-initial";
    case SuperResolutionHandoffReason::OwnerIneligible:
      return "owner-ineligible";
    case SuperResolutionHandoffReason::OwnerNoPresentationArea:
      return "owner-no-presentation-area";
    case SuperResolutionHandoffReason::ChallengerAreaHysteresis:
      return "challenger-area-hysteresis";
    case SuperResolutionHandoffReason::TieBreaker:
      return "tie-breaker";
  }
  return "unknown";
}

class VideoSuperResolutionOwnerPolicy {
 public:
  static constexpr float kAreaHysteresisRatio = 1.15f;

  static bool ShouldTakeOwnership(
      const SuperResolutionOwnerCandidate& aChallenger,
      const SuperResolutionOwnerCandidate* aCurrentOwner,
      SuperResolutionHandoffReason* aOutReason = nullptr);
};

}  // namespace mozilla::zen

#endif  // mozilla_zen_VideoSuperResolutionOwnerPolicy_h
