/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "VideoSuperResolutionCapability.h"

#include <dirent.h>
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>

#include "GLContext.h"
#include "mozilla/Logging.h"
#include "NvidiaVfxLoader.h"

#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
#include "mozilla/StaticPrefs_zen.h"
#endif

namespace mozilla::zen {

static LazyLogModule sVideoSuperResolutionLog("VideoSuperResolution");

VideoSuperResolutionCapability& VideoSuperResolutionCapability::Get() {
  static VideoSuperResolutionCapability sInstance;
  return sInstance;
}

bool VideoSuperResolutionCapability::ParseNvmlVersion(
    const char* aVersionStr, DriverVersion* aOut) {
  if (!aVersionStr || !aOut) {
    return false;
  }
  int maj = 0, min = 0, patch = 0;
  if (sscanf(aVersionStr, "%d.%d.%d", &maj, &min, &patch) >= 2) {
    aOut->major = maj;
    aOut->minor = min;
    aOut->patch = patch;
    aOut->isKnown = true;
    return true;
  }
  return false;
}

bool VideoSuperResolutionCapability::CheckDriverSupport(
    const DriverVersion& aDriver, const char** aReasonStr) {
  if (!aDriver.isKnown) {
    if (aReasonStr) *aReasonStr = "unknown-driver-version";
    return false;
  }

  if (aDriver.major < 570) {
    if (aReasonStr) *aReasonStr = "below-min-major-570";
    return false;
  }

  if (aDriver.major == 570) {
    if (aDriver.minor < 190) {
      if (aReasonStr) *aReasonStr = "570-branch-below-floor";
      return false;
    }
    if (aReasonStr) *aReasonStr = "supported-570-branch";
    return true;
  }

  if (aDriver.major == 580) {
    if (aDriver.minor < 82) {
      if (aReasonStr) *aReasonStr = "580-branch-below-floor";
      return false;
    }
    if (aReasonStr) *aReasonStr = "supported-580-branch";
    return true;
  }

  if (aDriver.major == 590) {
    if (aDriver.minor < 44) {
      if (aReasonStr) *aReasonStr = "590-branch-below-floor";
      return false;
    }
    if (aReasonStr) *aReasonStr = "supported-590-branch";
    return true;
  }

  if (aReasonStr) *aReasonStr = "future-driver-branch";
  return true;
}

void VideoSuperResolutionCapability::Invalidate(gl::GLContext* aGL) {
  if (!aGL || mLastProbedGL == aGL) {
    mState = SuperResolutionCapabilityState::Unknown;
    mReason = CapabilityReason::None;
    mLastProbedGL = nullptr;
    mGpuInfo = GpuDeviceInfo{};
    mDriverVersion = DriverVersion{};
    mTopology = SystemGpuTopology{};
  }
}

bool VideoSuperResolutionCapability::Probe(gl::GLContext* aGL) {
  if (!aGL) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::None;
    return false;
  }

#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
  if (!StaticPrefs::zen_video_super_resolution_enabled()) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::DisabledByPref;
    mLastProbedGL = nullptr;
    mGpuInfo = GpuDeviceInfo{};
    mDriverVersion = DriverVersion{};
    mTopology = SystemGpuTopology{};
    return false;
  }
#endif

  if (mState != SuperResolutionCapabilityState::Unknown && mLastProbedGL == aGL) {
    return mState == SuperResolutionCapabilityState::Available;
  }

  mLastProbedGL = aGL;
  mState = SuperResolutionCapabilityState::Probing;

  mTopology = SystemGpuTopology{};
  if (const char* rend = (const char*)aGL->fGetString(LOCAL_GL_RENDERER)) {
    snprintf(mTopology.activeGlRenderer, sizeof(mTopology.activeGlRenderer), "%s", rend);
  }
  if (const char* vend = (const char*)aGL->fGetString(LOCAL_GL_VENDOR)) {
    snprintf(mTopology.activeGlVendorString, sizeof(mTopology.activeGlVendorString), "%s", vend);
  }

  DIR* dir = opendir("/dev/dri");
  if (dir) {
    struct dirent* entry;
    int renderCount = 0;
    while ((entry = readdir(dir)) != nullptr) {
      if (strncmp(entry->d_name, "renderD", 7) == 0) {
        if (renderCount == 0) {
          snprintf(mTopology.renderNode, sizeof(mTopology.renderNode),
                   "/dev/dri/%s", entry->d_name);
        }
        renderCount++;
      }
    }
    closedir(dir);
    mTopology.hybridSystem = (renderCount > 1);
  }

  if (aGL->Vendor() != gl::GLVendor::NVIDIA) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::NonNvidiaGL;
    return false;
  }

  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  if (!loader.EnsureCudaLib()) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::CudaLibraryMissing;
    MOZ_LOG(sVideoSuperResolutionLog, LogLevel::Warning,
            ("VSR unavailable: CUDA driver library missing"));
    return false;
  }
  if (loader.CuInit(0) != 0) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::CudaInitFailed;
    return false;
  }

  unsigned int count = 0;
  CuDevice devices[4] = {-1, -1, -1, -1};
  const char* glMode = "CURRENT_FRAME";
  int glRc = loader.CuGLGetDevices(&count, devices, 4, 0x02);
  if (glRc != 0 || count == 0) {
    glMode = "ALL";
    glRc = loader.CuGLGetDevices(&count, devices, 4, 0x01);
  }
  if (glRc != 0 || count == 0) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::NoGlCudaDevice;
    return false;
  }
  if (count > 1) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::AmbiguousGlCudaDevice;
    return false;
  }

  mGpuInfo.glDeviceMode = glMode;
  CuDevice glDevice = devices[0];
  mGpuInfo.glCudaDevice = glDevice;

  int devCount = 0;
  if (loader.CuDeviceGetCount(&devCount) != 0 || devCount <= 0) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::NoGlCudaDevice;
    return false;
  }
  int resolvedOrdinal = -1;
  for (int i = 0; i < devCount; ++i) {
    CuDevice cand = -1;
    if (loader.CuDeviceGet(&cand, i) == 0 && cand == glDevice) {
      resolvedOrdinal = i;
      break;
    }
  }
  if (resolvedOrdinal < 0) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::GpuOrdinalResolutionFailed;
    return false;
  }
  mGpuInfo.cudaOrdinal = resolvedOrdinal;

  loader.CuDeviceGetName(mGpuInfo.name, sizeof(mGpuInfo.name),
                         mGpuInfo.glCudaDevice);
  loader.CuDeviceGetAttribute(&mGpuInfo.computeMajor, 75,
                              mGpuInfo.glCudaDevice);
  loader.CuDeviceGetAttribute(&mGpuInfo.computeMinor, 76,
                              mGpuInfo.glCudaDevice);
  loader.CuDeviceGetUuid(&mGpuInfo.uuid, mGpuInfo.glCudaDevice);
  CuDevice crossCheckDevice = -1;
  CudaDeviceUuid crossCheckUuid{};
  if (loader.CuDeviceGet(&crossCheckDevice, resolvedOrdinal) != 0 ||
      loader.CuDeviceGetUuid(&crossCheckUuid, crossCheckDevice) != 0 ||
      memcmp(mGpuInfo.uuid.bytes, crossCheckUuid.bytes,
             sizeof(mGpuInfo.uuid.bytes)) != 0) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::GpuOrdinalResolutionFailed;
    return false;
  }

  mDriverVersion = DriverVersion{};
  void* nvml = dlopen("libnvidia-ml.so.1", RTLD_NOW | RTLD_LOCAL);
  if (!nvml) {
    nvml = dlopen("libnvidia-ml.so", RTLD_NOW | RTLD_LOCAL);
  }
  if (nvml) {
    auto fnInit = (int (*)())dlsym(nvml, "nvmlInit_v2");
    if (!fnInit) fnInit = (int (*)())dlsym(nvml, "nvmlInit");
    auto fnVer = (int (*)(char*, unsigned int))dlsym(nvml, "nvmlSystemGetDriverVersion");
    auto fnShutdown = (int (*)())dlsym(nvml, "nvmlShutdown");

    if (fnInit && fnVer && fnInit() == 0) {
      char vBuf[64] = {0};
      if (fnVer(vBuf, sizeof(vBuf)) == 0) {
        ParseNvmlVersion(vBuf, &mDriverVersion);
      }
      if (fnShutdown) fnShutdown();
    }
    dlclose(nvml);
  }

  if (mDriverVersion.isKnown && !CheckDriverSupport(mDriverVersion)) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::DriverTooOld;
    return false;
  }

  if (!loader.HasGlInterop()) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::InteropFailed;
    MOZ_LOG(sVideoSuperResolutionLog, LogLevel::Warning,
            ("VSR unavailable: CUDA/GL interop unavailable"));
    return false;
  }

  if (!loader.EnsureLoaded()) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::VfxCoreMissing;
    return false;
  }
  if (loader.SetS32(nullptr, kGpuParam, resolvedOrdinal) != 0) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::VideoSuperResMissing;
    return false;
  }
  int vfxOrdinal = -1;
  if (loader.GetS32(nullptr, kGpuParam, &vfxOrdinal) != 0 ||
      vfxOrdinal != resolvedOrdinal) {
    mState = SuperResolutionCapabilityState::Unavailable;
    mReason = CapabilityReason::GpuOrdinalResolutionFailed;
    return false;
  }

  mState = SuperResolutionCapabilityState::Available;
  mReason = CapabilityReason::Available;
  return true;
}

}  // namespace mozilla::zen
