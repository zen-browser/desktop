/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_VideoSuperResolutionScalePolicy_h
#define mozilla_zen_VideoSuperResolutionScalePolicy_h

#include "mozilla/gfx/Point.h"
#include "mozilla/zen/VideoSuperResolutionTypes.h"

namespace mozilla::zen {

class VideoSuperResolutionScalePolicy {
 public:
  static constexpr int kMinSourceShortSide = 360;
  static constexpr int kMaxSourceLongSide = 2560;
  static constexpr int kMaxOutputWidth = 3840;
  static constexpr int kMaxOutputHeight = 2160;

  static SuperResolutionConfig ReadConfigFromPrefs();

  static SuperResolutionTargetDecision EvaluateTarget(
      const gfx::IntSize& aSourceSize, float aDisplayW, float aDisplayH);

  static SuperResolutionTargetDecision ComputeTarget(
      int aSourceW, int aSourceH, float aDisplayW, float aDisplayH,
      SuperResolutionScaleMode aMode, unsigned int aManualScalePercent,
      SuperResolutionQuality aQuality);

  static SuperResolutionTargetDecision ComputeTarget(
      int aSourceW, int aSourceH, float aDisplayW, float aDisplayH,
      SuperResolutionScaleMode aMode, unsigned int aManualScalePercent) {
    return ComputeTarget(aSourceW, aSourceH, aDisplayW, aDisplayH, aMode,
                         aManualScalePercent, kDefaultQuality);
  }
};

}  // namespace mozilla::zen

#endif  // mozilla_zen_VideoSuperResolutionScalePolicy_h
