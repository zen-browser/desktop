/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "VideoSuperResolutionScalePolicy.h"

#include <algorithm>
#include <cmath>

#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
#include "mozilla/StaticPrefs_zen.h"
#endif

namespace mozilla::zen {

SuperResolutionConfig VideoSuperResolutionScalePolicy::ReadConfigFromPrefs() {
  SuperResolutionConfig config;
#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
  config.enabled = StaticPrefs::zen_video_super_resolution_enabled();
  config.scaleMode = SuperResolutionScaleModeFromPref(
      StaticPrefs::zen_video_super_resolution_scale_mode());
  config.manualScalePercent =
      StaticPrefs::zen_video_super_resolution_scale();
  config.quality = SuperResolutionQualityFromPref(
      StaticPrefs::zen_video_super_resolution_quality());
#endif
  return config;
}

SuperResolutionTargetDecision VideoSuperResolutionScalePolicy::EvaluateTarget(
    const gfx::IntSize& aSourceSize, float aDisplayW, float aDisplayH) {
  const SuperResolutionConfig config = ReadConfigFromPrefs();
  return ComputeTarget(aSourceSize.width, aSourceSize.height, aDisplayW,
                       aDisplayH, config.scaleMode, config.manualScalePercent,
                       config.quality);
}

SuperResolutionTargetDecision VideoSuperResolutionScalePolicy::ComputeTarget(
    int aSourceW, int aSourceH, float aDisplayW, float aDisplayH,
    SuperResolutionScaleMode aMode, unsigned int aManualScalePercent,
    SuperResolutionQuality aQuality) {
  SuperResolutionTargetDecision decision;
  decision.scaleMode = aMode;
  decision.quality = aQuality;

  if (aSourceW <= 0 || aSourceH <= 0) {
    decision.bypassReason = "unsupported-source-resolution";
    return decision;
  }
  const int shortSide = std::min(aSourceW, aSourceH);
  const int longSide = std::max(aSourceW, aSourceH);
  if (shortSide < kMinSourceShortSide || longSide > kMaxSourceLongSide) {
    decision.bypassReason = "unsupported-source-resolution";
    return decision;
  }

  if (!std::isfinite(aDisplayW) || !std::isfinite(aDisplayH) ||
      aDisplayW <= 0.0f || aDisplayH <= 0.0f) {
    decision.bypassReason = "invalid-display-dimensions";
    return decision;
  }

  const float upscaleW = aDisplayW / float(aSourceW);
  const float upscaleH = aDisplayH / float(aSourceH);
  const float fitUpscale = std::min(upscaleW, upscaleH);
  if (fitUpscale < 1.0f) {
    decision.bypassReason = "downscale-not-eligible";
    return decision;
  }

  int targetW = 0;
  int targetH = 0;

  if (aMode == SuperResolutionScaleMode::Auto) {
    // Native-size presentation still uses VFX enhancement for denoise/detail
    // recovery; only true downscales bypass above.
    targetW = static_cast<int>(std::ceil(float(aSourceW) * fitUpscale));
    targetH = static_cast<int>(std::ceil(float(aSourceH) * fitUpscale));
  } else {
    unsigned int percent = aManualScalePercent;
    if (percent < 133) percent = 133;
    if (percent > 400) percent = 400;
    targetW = static_cast<int>(
        std::round(float(aSourceW) * float(percent) / 100.0f));
    targetH = static_cast<int>(
        std::round(float(aSourceH) * float(percent) / 100.0f));
  }

  if (targetW > kMaxOutputWidth || targetH > kMaxOutputHeight) {
    const float scaleX = float(kMaxOutputWidth) / float(targetW);
    const float scaleY = float(kMaxOutputHeight) / float(targetH);
    const float clampScale = std::min(scaleX, scaleY);
    targetW = std::max(aSourceW, static_cast<int>(std::floor(float(targetW) * clampScale)));
    targetH = std::max(aSourceH, static_cast<int>(std::floor(float(targetH) * clampScale)));
  }

  targetW = (targetW + 1) & ~1;
  targetH = (targetH + 1) & ~1;

  if (targetW < aSourceW || targetH < aSourceH) {
    decision.bypassReason = "clamped-below-source";
    return decision;
  }

  decision.eligible = true;
  decision.outputWidth = targetW;
  decision.outputHeight = targetH;
  return decision;
}

}  // namespace mozilla::zen
