/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_VideoSuperResolutionProfiler_h
#define mozilla_zen_VideoSuperResolutionProfiler_h

#include "GeckoProfiler.h"
#include "mozilla/ProfilerMarkerTypes.h"
#include "VideoSuperResolutionTypes.h"

namespace mozilla::zen {

inline constexpr char kMarkerSnapshot[] = "VideoSuperResolution Snapshot";
inline constexpr char kMarkerSubmit[] = "VideoSuperResolution Submit";
inline constexpr char kMarkerVfxStart[] = "VideoSuperResolution VFX Start";
inline constexpr char kMarkerVfxEnd[] = "VideoSuperResolution VFX End";
inline constexpr char kMarkerComplete[] = "VideoSuperResolution Complete";
inline constexpr char kMarkerReady[] = "VideoSuperResolution Ready";
inline constexpr char kMarkerPresent[] = "VideoSuperResolution Present";
inline constexpr char kMarkerDrop[] = "VideoSuperResolution Drop";
inline constexpr char kMarkerOwnerChange[] = "VideoSuperResolution OwnerChange";
inline constexpr char kMarkerContextReset[] = "VideoSuperResolution ContextReset";
inline constexpr char kMarkerComposition[] = "VideoSuperResolution Composition";

inline bool SuperResolutionProfilerActive() {
  return profiler_thread_is_being_profiled_for_markers();
}

template <size_t N>
inline void MarkToken(const char (&aMarker)[N],
                      const SuperResolutionFrameToken& aToken,
                      const char* aReason = nullptr) {
  if (!SuperResolutionProfilerActive()) {
    return;
  }
  if (aReason) {
    PROFILER_MARKER_FMT(
        aMarker, GRAPHICS, {},
        "producer={} frame={} session={} config={} context={} src={}x{} out={}x{} reason={}",
        aToken.producer, aToken.frame, aToken.sessionGeneration,
        aToken.configGeneration, aToken.contextGeneration, aToken.sourceWidth,
        aToken.sourceHeight, aToken.outputWidth, aToken.outputHeight, aReason);
  } else {
    PROFILER_MARKER_FMT(
        aMarker, GRAPHICS, {},
        "producer={} frame={} session={} config={} context={} src={}x{} out={}x{}",
        aToken.producer, aToken.frame, aToken.sessionGeneration,
        aToken.configGeneration, aToken.contextGeneration, aToken.sourceWidth,
        aToken.sourceHeight, aToken.outputWidth, aToken.outputHeight);
  }
}

inline void MarkComposition(uint64_t aPipeline, bool aSelected,
                            const char* aReason) {
  if (!SuperResolutionProfilerActive()) {
    return;
  }
  PROFILER_MARKER_FMT(kMarkerComposition, GRAPHICS, {},
                      "pipe={} path={} reason={}", aPipeline,
                      aSelected ? "enhanced-rgba" : "normal-nv12",
                      aReason ? aReason : "");
}

}  // namespace mozilla::zen

#endif  // mozilla_zen_VideoSuperResolutionProfiler_h
