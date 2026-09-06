/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_VideoSuperResolutionCapability_h
#define mozilla_zen_VideoSuperResolutionCapability_h

#include "VideoSuperResolutionTypes.h"

namespace mozilla::gl {
class GLContext;
}

namespace mozilla::zen {

enum class CapabilityReason {
  None,
  Available,
  DisabledByPref,
  NonNvidiaGL,
  CudaLibraryMissing,
  CudaInitFailed,
  NoGlCudaDevice,
  AmbiguousGlCudaDevice,
  GpuOrdinalResolutionFailed,
  DriverTooOld,
  DriverVersionUnknown,
  VfxCoreMissing,
  VideoSuperResMissing,
  InteropFailed,
  TerminalRuntimeFailure,
};

inline const char* CapabilityReasonToString(CapabilityReason aReason) {
  switch (aReason) {
    case CapabilityReason::None:
      return "none";
    case CapabilityReason::Available:
      return "available";
    case CapabilityReason::DisabledByPref:
      return "disabled-by-pref";
    case CapabilityReason::NonNvidiaGL:
      return "non-nvidia-gl";
    case CapabilityReason::CudaLibraryMissing:
      return "cuda-library-missing";
    case CapabilityReason::CudaInitFailed:
      return "cuda-init-failed";
    case CapabilityReason::NoGlCudaDevice:
      return "no-gl-cuda-device";
    case CapabilityReason::AmbiguousGlCudaDevice:
      return "ambiguous-gl-cuda-device";
    case CapabilityReason::GpuOrdinalResolutionFailed:
      return "gpu-ordinal-resolution-failed";
    case CapabilityReason::DriverTooOld:
      return "driver-too-old";
    case CapabilityReason::DriverVersionUnknown:
      return "driver-version-unknown";
    case CapabilityReason::VfxCoreMissing:
      return "vfx-core-missing";
    case CapabilityReason::VideoSuperResMissing:
      return "video-super-res-missing";
    case CapabilityReason::InteropFailed:
      return "interop-failed";
    case CapabilityReason::TerminalRuntimeFailure:
      return "terminal-runtime-failure";
  }
  return "unknown";
}

struct DriverVersion {
  int major = 0;
  int minor = 0;
  int patch = 0;
  bool isKnown = false;
};

struct GpuDeviceInfo {
  char name[128] = {0};
  int computeMajor = 0;
  int computeMinor = 0;
  CudaDeviceHandle glCudaDevice = -1;
  int cudaOrdinal = -1;
  CudaDeviceUuid uuid{};
  const char* glDeviceMode = "NONE";
};

struct SystemGpuTopology {
  bool hybridSystem = false;
  char renderNode[64] = {0};
  char activeGlRenderer[128] = {0};
  char activeGlVendorString[64] = {0};
};

class VideoSuperResolutionCapability {
 public:
  static VideoSuperResolutionCapability& Get();

  bool Probe(gl::GLContext* aGL);
  void Invalidate(gl::GLContext* aGL);

  SuperResolutionCapabilityState GetState() const { return mState; }
  CapabilityReason GetReason() const { return mReason; }
  CudaDeviceHandle GetGlCudaDevice() const { return mGpuInfo.glCudaDevice; }
  int GetCudaOrdinal() const { return mGpuInfo.cudaOrdinal; }
  const GpuDeviceInfo& GetGpuInfo() const { return mGpuInfo; }
  const DriverVersion& GetDriverVersion() const { return mDriverVersion; }
  const SystemGpuTopology& GetTopology() const { return mTopology; }

  static bool CheckDriverSupport(const DriverVersion& aDriver,
                                 const char** aReasonStr = nullptr);
  static bool ParseNvmlVersion(const char* aVersionStr, DriverVersion* aOut);

 private:
  VideoSuperResolutionCapability() = default;
  ~VideoSuperResolutionCapability() = default;
  VideoSuperResolutionCapability(const VideoSuperResolutionCapability&) = delete;
  VideoSuperResolutionCapability& operator=(const VideoSuperResolutionCapability&) = delete;

  SuperResolutionCapabilityState mState = SuperResolutionCapabilityState::Unknown;
  CapabilityReason mReason = CapabilityReason::None;
  gl::GLContext* mLastProbedGL = nullptr;
  GpuDeviceInfo mGpuInfo;
  DriverVersion mDriverVersion;
  SystemGpuTopology mTopology;
};

}  // namespace mozilla::zen

#endif  // mozilla_zen_VideoSuperResolutionCapability_h
