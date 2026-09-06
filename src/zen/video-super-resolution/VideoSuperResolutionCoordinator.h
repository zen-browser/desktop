/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_VideoSuperResolutionCoordinator_h
#define mozilla_zen_VideoSuperResolutionCoordinator_h

#include <stdint.h>

#include "mozilla/Mutex.h"
#include "mozilla/zen/VideoSuperResolutionTypes.h"
#include "nsTArray.h"

namespace mozilla::zen {

class VideoSuperResolutionCoordinator {
 public:
  static VideoSuperResolutionCoordinator& Get();

  bool NoteSelected(uint64_t aPipeline, const SuperResolutionFrameToken& aToken);

  bool LookupReady(uint64_t aPipeline, const SuperResolutionFrameToken& aCurrent,
                   SuperResolutionFrameToken* aMatched);

  void NotePresented(uint64_t aPipeline, const SuperResolutionFrameToken& aToken);

  bool WasPresented(uint64_t aPipeline, const SuperResolutionFrameToken& aToken);

  bool NoteExternalCompleted(uint64_t aPipeline,
                             const SuperResolutionFrameToken& aToken);

  void InvalidatePipeline(uint64_t aPipeline);

  void InvalidateAll();

  uint64_t SyncConfigFromPrefs();

 private:
  VideoSuperResolutionCoordinator();
  ~VideoSuperResolutionCoordinator() = default;
  VideoSuperResolutionCoordinator(const VideoSuperResolutionCoordinator&) = delete;
  VideoSuperResolutionCoordinator& operator=(const VideoSuperResolutionCoordinator&) = delete;

  struct PipelineState {
    uint64_t pipeline = 0;
    bool hasSelected = false;
    SuperResolutionFrameToken lastSelected;
    bool hasPresented = false;
    SuperResolutionFrameToken lastPresented;
    nsTArray<SuperResolutionFrameToken> completed;
  };

  PipelineState* FindPipeline(uint64_t aPipeline);
  PipelineState& EnsurePipeline(uint64_t aPipeline);

  Mutex mLock{"VideoSuperResolutionCoordinator"};
  AutoTArray<PipelineState, 4> mPipelines;
  uint64_t mConfigGeneration = 1;
  bool mConfigInitialized = false;
  SuperResolutionConfig mLastConfig;
};

}  // namespace mozilla::zen

#endif  // mozilla_zen_VideoSuperResolutionCoordinator_h
