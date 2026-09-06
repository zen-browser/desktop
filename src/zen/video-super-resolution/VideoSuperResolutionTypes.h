/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_VideoSuperResolutionTypes_h
#define mozilla_zen_VideoSuperResolutionTypes_h

#include <cstdint>

namespace mozilla::zen {

using CudaDeviceHandle = int;

struct CudaDeviceUuid {
  char bytes[16];
};
static_assert(sizeof(CudaDeviceUuid) == 16, "CudaDeviceUuid must match CUuuid (16 bytes)");
static_assert(alignof(CudaDeviceUuid) == 1, "CudaDeviceUuid has 1-byte natural alignment");

inline constexpr unsigned int kDefaultScalePercent = 200;
inline constexpr int64_t kMaxFrameLag = 3;

enum class SuperResolutionQuality : unsigned int {
  Bicubic = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  Ultra = 4,
};

inline constexpr SuperResolutionQuality kDefaultQuality = SuperResolutionQuality::High;

inline SuperResolutionQuality SuperResolutionQualityFromPref(uint32_t aPref) {
  switch (aPref) {
    case 0:
      return SuperResolutionQuality::Bicubic;
    case 1:
      return SuperResolutionQuality::Low;
    case 2:
      return SuperResolutionQuality::Medium;
    case 3:
      return SuperResolutionQuality::High;
    case 4:
      return SuperResolutionQuality::Ultra;
    default:
      return kDefaultQuality;
  }
}

inline uint32_t SuperResolutionQualityToNvVfx(SuperResolutionQuality aQuality) {
  return static_cast<uint32_t>(aQuality);
}

inline const char* SuperResolutionQualityToString(SuperResolutionQuality aQuality) {
  switch (aQuality) {
    case SuperResolutionQuality::Bicubic:
      return "Bicubic";
    case SuperResolutionQuality::Low:
      return "Low";
    case SuperResolutionQuality::Medium:
      return "Medium";
    case SuperResolutionQuality::High:
      return "High";
    case SuperResolutionQuality::Ultra:
      return "Ultra";
  }
  return "High";
}

enum class SuperResolutionScaleMode : unsigned int {
  Auto = 0,
  Manual = 1,
};

inline SuperResolutionScaleMode SuperResolutionScaleModeFromPref(uint32_t aPref) {
  switch (aPref) {
    case 0:
      return SuperResolutionScaleMode::Auto;
    case 1:
      return SuperResolutionScaleMode::Manual;
    default:
      return SuperResolutionScaleMode::Auto;
  }
}

inline const char* SuperResolutionScaleModeToString(SuperResolutionScaleMode aMode) {
  switch (aMode) {
    case SuperResolutionScaleMode::Auto:
      return "Auto";
    case SuperResolutionScaleMode::Manual:
      return "Manual";
  }
  return "Auto";
}

enum class SuperResolutionCapabilityState {
  Unknown,
  Probing,
  Available,
  Unavailable,
  Failed,
};

struct SuperResolutionConfig {
  bool enabled = false;
  SuperResolutionScaleMode scaleMode = SuperResolutionScaleMode::Auto;
  unsigned int manualScalePercent = kDefaultScalePercent;
  SuperResolutionQuality quality = kDefaultQuality;

  bool SemanticallyEquals(const SuperResolutionConfig& aOther) const {
    if (enabled != aOther.enabled ||
        scaleMode != aOther.scaleMode ||
        quality != aOther.quality) {
      return false;
    }
    if (scaleMode == SuperResolutionScaleMode::Manual) {
      if (manualScalePercent != aOther.manualScalePercent) {
        return false;
      }
    }
    return true;
  }

  bool operator==(const SuperResolutionConfig& aOther) const {
    return SemanticallyEquals(aOther);
  }
  bool operator!=(const SuperResolutionConfig& aOther) const {
    return !SemanticallyEquals(aOther);
  }
};

struct SuperResolutionFrameToken {
  uint32_t producer = 0;
  int32_t frame = 0;
  uint64_t sessionGeneration = 0;
  uint64_t configGeneration = 0;
  uint64_t contextGeneration = 0;
  int sourceWidth = 0;
  int sourceHeight = 0;
  int outputWidth = 0;
  int outputHeight = 0;

  bool HasIdentity() const { return producer != 0; }

  bool MatchesStream(const SuperResolutionFrameToken& aOther) const {
    return producer == aOther.producer &&
           sessionGeneration == aOther.sessionGeneration &&
           configGeneration == aOther.configGeneration &&
           contextGeneration == aOther.contextGeneration &&
           sourceWidth == aOther.sourceWidth &&
           sourceHeight == aOther.sourceHeight &&
           outputWidth == aOther.outputWidth &&
           outputHeight == aOther.outputHeight;
  }

  bool MatchesExact(const SuperResolutionFrameToken& aOther) const {
    return frame == aOther.frame && MatchesStream(aOther);
  }

  bool operator==(const SuperResolutionFrameToken& aOther) const {
    return MatchesExact(aOther);
  }
  bool operator!=(const SuperResolutionFrameToken& aOther) const {
    return !MatchesExact(aOther);
  }
};

struct SuperResolutionTargetDecision {
  bool eligible = false;
  int outputWidth = 0;
  int outputHeight = 0;
  SuperResolutionScaleMode scaleMode = SuperResolutionScaleMode::Auto;
  SuperResolutionQuality quality = kDefaultQuality;
  const char* bypassReason = nullptr;
};

struct NvCVImage {
  unsigned int width = 0;
  unsigned int height = 0;
  int pitch = 0;
  int pixelFormat = 0;
  int componentType = 0;
  unsigned char pixelBytes = 0;
  unsigned char componentBytes = 0;
  unsigned char numComponents = 0;
  unsigned char planar = 0;
  unsigned char gpuMem = 0;
  unsigned char colorspace = 0;
  unsigned char reserved[2] = {};
  void* pixels = nullptr;
  void* deletePtr = nullptr;
  void* deleteProc = nullptr;
  unsigned long long bufferBytes = 0;
};
static_assert(sizeof(NvCVImage) == 64, "NvCVImage must match 64-bit layout");

inline constexpr int kNvFormatRGBA = 6;
inline constexpr int kNvTypeU8 = 1;
inline constexpr int kNvChunky = 0;
inline constexpr int kNvGpuMem = 1;

inline constexpr char kVideoSuperResEffect[] = "VideoSuperRes";
inline constexpr char kQualityLevelParam[] = "QualityLevel";
inline constexpr char kGpuParam[] = "GPU";
inline constexpr char kSrcImageParam[] = "SrcImage0";
inline constexpr char kDstImageParam[] = "DstImage0";
inline constexpr char kCudaStreamParam[] = "CudaStream";

enum class SuperResolutionSessionState {
  Uninitialized,
  Loading,
  Ready,
  Failed,
  ShuttingDown,
};

enum class SuperResolutionCompositionReason {
  OwnerActivated,
  OwnerSelected,
  OwnerLost,
  Disabled,
  ScaleBypass,
  FormatBypass,
  Failure,
  RendererReset,
  PipelineRemoved,
};

inline const char* SuperResolutionCompositionReasonToString(
    SuperResolutionCompositionReason aReason) {
  switch (aReason) {
    case SuperResolutionCompositionReason::OwnerActivated:
      return "owner-activated";
    case SuperResolutionCompositionReason::OwnerSelected:
      return "owner-selected";
    case SuperResolutionCompositionReason::OwnerLost:
      return "owner-lost";
    case SuperResolutionCompositionReason::Disabled:
      return "disabled";
    case SuperResolutionCompositionReason::ScaleBypass:
      return "scale-bypass";
    case SuperResolutionCompositionReason::FormatBypass:
      return "format-bypass";
    case SuperResolutionCompositionReason::Failure:
      return "failure";
    case SuperResolutionCompositionReason::RendererReset:
      return "renderer-reset";
    case SuperResolutionCompositionReason::PipelineRemoved:
      return "pipeline-removed";
  }
  return "unknown";
}

}  // namespace mozilla::zen

#endif  // mozilla_zen_VideoSuperResolutionTypes_h
