/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_VideoSuperResolutionTexturePool_h
#define mozilla_zen_VideoSuperResolutionTexturePool_h

#include <stdint.h>

#include "mozilla/Atomics.h"
#include "mozilla/Mutex.h"
#include "mozilla/RefPtr.h"
#include "mozilla/TimeStamp.h"
#include "mozilla/webrender/RenderTextureHost.h"
#include "mozilla/zen/VideoSuperResolutionOwnerPolicy.h"
#include "mozilla/zen/VideoSuperResolutionTypes.h"
#include "nsTArray.h"

class DMABufSurface;

namespace mozilla {

namespace gl {
class GLContext;
}

namespace layers {
class WebRenderImageHost;
}

namespace wr {
class TransactionBuilder;
struct ExternalImageId;
struct ImageKey;
}

namespace zen {

class NvidiaVfxSession;

class VideoSuperResolutionTexturePool {
 public:
  static VideoSuperResolutionTexturePool& Get();

  static constexpr size_t kMaxSourceSurfaces = 8;

  bool ShouldActivate(bool aIsHardwareBackend);
  bool IsAvailable(gl::GLContext* aGL);
  bool HasFailed();

  bool CanClaimOwner(uint64_t aPipeline, float aDisplayW, float aDisplayH);
  CudaDeviceHandle GetGlCudaDevice();
  int GetCudaOrdinal();
  uint64_t GetContextGeneration(uint64_t aPipeline);

  bool EnsureInitialized();
  int SlotCount();

  int AcquireDownloadSlot(const SuperResolutionFrameToken& aToken,
                          uint32_t aRenderer = 0);
  int FindReadySlot(const SuperResolutionFrameToken& aToken,
                    uint32_t aRenderer = 0);
  void DiscardReady(int aSlot);

  bool Publish(uint64_t aPipeline, int aSlot,
               const SuperResolutionFrameToken& aToken,
               wr::ExternalImageId* aExtId);
  void Unpublish(uint64_t aPipeline);

  bool TryHoldPublished(uint64_t aPipeline,
                        const SuperResolutionFrameToken& aCurrent,
                        SuperResolutionFrameToken* aHeldToken);

  bool EnsureKeyResource(wr::TransactionBuilder& aTxn, bool aIsAdd,
                         const wr::ImageKey& aKey, uint64_t aPipeline);

  void RequestSnapshot(const SuperResolutionFrameToken& aToken, uint64_t aPipeline,
                       uint64_t aSourceIdentity);
  void BindPipelineImageHost(uint64_t aPipeline,
                             const RefPtr<layers::WebRenderImageHost>& aHost,
                             uint32_t aRenderer);
  void NotifyVfxStreamComplete(const SuperResolutionFrameToken& aToken);

  void SnapshotFromSurface(DMABufSurface* aSurface, gl::GLContext* aGL,
                           uint64_t aSourceIdentity);

  void RegisterSourceSurface(uint64_t aIdentity, DMABufSurface* aSurface);
  void UnregisterSourceSurface(uint64_t aIdentity, DMABufSurface* aSurface);
  void ProcessPendingSnapshots(gl::GLContext* aGL);

  uint64_t GetSessionGeneration();
  bool VfxEnabled();

  bool UnregisterSlotTexture(unsigned int aTex);
  bool IsSlotReady(int aSlot);
  void InvalidateSlot(int aSlot);

  void ReleasePipeline(uint64_t aPipeline, uint64_t aEpoch);

  void NoteTransaction(uint64_t aPipeline, uint64_t aEpoch);
  void NotePipelineComposite(uint64_t aPipeline);
  void NotePipelineRendered(uint64_t aPipeline, uint64_t aEpoch,
                            uint64_t aRenderedFrame, uint32_t aRenderer,
                            uint64_t aCompletedFrame);
  void NotePipelineRemoved(uint64_t aPipeline, uint64_t aRenderedFrame,
                           uint32_t aRenderer, uint64_t aCompletedFrame);
  void NoteCompletedRender(uint32_t aRenderer, uint64_t aCompletedFrame);
  void OnRendererDestroyed(uint32_t aRenderer, gl::GLContext* aGL);

  void PollVfxResults(gl::GLContext* aGL);

  bool GetSlotToken(int aSlot, SuperResolutionFrameToken* aOut);

 private:
  RefPtr<NvidiaVfxSession> GetSession();

  VideoSuperResolutionTexturePool();
  ~VideoSuperResolutionTexturePool() = default;
  VideoSuperResolutionTexturePool(const VideoSuperResolutionTexturePool&) = delete;
  VideoSuperResolutionTexturePool& operator=(const VideoSuperResolutionTexturePool&) = delete;

  enum class SlotState { Free, Ready, Published, Retiring };

  struct Slot {
    SlotState state = SlotState::Free;
    SuperResolutionFrameToken token;
    uint32_t renderer = 0;
    bool contentReady = false;
  };

  struct PipeDisplay {
    uint64_t pipeline = 0;
    uint32_t renderer = 0;
    uint64_t contextGeneration = 0;
    int slot = -1;
    bool keyValid = false;
    int keySlot = -1;
    int retiringSlot = -1;
    RefPtr<layers::WebRenderImageHost> imageHost;
    bool pollWakePending = false;
    bool presentationWakePending = false;
    TimeStamp lastCompositeTime;
  };

  struct PipeSubmission {
    uint64_t pipeline = 0;
    SuperResolutionFrameToken token;
  };

  struct SnapshotRequest {
    SuperResolutionFrameToken token;
    uint64_t pipeline = 0;
    uint64_t sourceIdentity = 0;
  };

  struct RetireFence {
    uint64_t pipeline = 0;
    uint32_t renderer = 0;
    int slot = -1;
    uint64_t epoch = 0;
    uint64_t renderedFrame = 0;
  };

  int FindFreeSlot();
  void RetireSlot(PipeDisplay& aPipe, int aSlot, uint64_t aEpoch = 0);
  void InvalidateSlotLocked(int aSlot);
  void RecycleCompleted(uint32_t aRenderer, uint64_t aCompletedFrame);
  void QueueCompositionWakeup(uint64_t aPipeline,
                              const SuperResolutionFrameToken& aToken,
                              bool aForcePollRender);
  void ProcessCompositionWakeup(uint64_t aPipeline,
                                const SuperResolutionFrameToken& aToken,
                                bool aForcePollRender);
  bool EnsureCudaDevice(gl::GLContext* aGL);
  bool DeleteStagingResources(gl::GLContext* aGL, unsigned int aTexture,
                              unsigned int aFbo);
  void PollSessionDownloads(gl::GLContext* aGL);
  PipeDisplay& EnsurePipe(uint64_t aPipeline);
  PipeDisplay* FindPipe(uint64_t aPipeline);
  bool DisplayedElsewhere(int aSlot, uint64_t aExceptPipeline);

  Mutex mLock{"VideoSuperResolutionTexturePool"};
  AutoTArray<Slot, 4> mSlots;
  AutoTArray<PipeDisplay, 4> mPipes;
  AutoTArray<PipeSubmission, 4> mPipeSubmissions;
  AutoTArray<RetireFence, 8> mRetireFences;
  AutoTArray<RefPtr<wr::RenderTextureHost>, 4> mHosts;
  AutoTArray<wr::ExternalImageId, 4> mExtIds;

  int mOutW = 0;
  int mOutH = 0;
  RefPtr<NvidiaVfxSession> mSession;
  uint64_t mSessionGeneration = 0;
  uint64_t mNextContextGeneration = 0;
  uint32_t mSessionRenderer = 0;
  CudaDeviceHandle mGlCudaDevice = -2;
  int mCudaOrdinal = -2;
  RefPtr<gl::GLContext> mCudaGL;

  unsigned int mStagingTex = 0;
  unsigned int mStagingFbo = 0;
  int mStagingW = 0;
  int mStagingH = 0;

  struct SourceSurfaceEntry {
    uint64_t identity = 0;
    RefPtr<DMABufSurface> surface;
  };
  AutoTArray<SourceSurfaceEntry, kMaxSourceSurfaces> mSourceSurfaces;

  AutoTArray<SnapshotRequest, 4> mSnapshotRequests;
  uint64_t mInputPipeline = 0;
  uint64_t mCurrentOwner = 0;
  AutoTArray<SuperResolutionOwnerCandidate, 4> mCandidates;
  SuperResolutionFrameToken mLastSnapshotRequest;
  uint64_t mLastSnapshotPipeline = 0;
  bool mHasLastSnapshotRequest = false;
  bool mSawCapabilityFailed = false;
  Atomic<bool> mLastVfxEnabled{false};
  size_t mSlotCount = 3;
};

class SuperResolutionSlotTextureHost final : public wr::RenderTextureHost {
 public:
  explicit SuperResolutionSlotTextureHost(int aSlot);

  wr::WrExternalImage Lock(uint8_t aChannelIndex,
                           gl::GLContext* aGL) override;
  void Unlock() override {}
  void ClearCachedResources() override;
  size_t Bytes() override;

  bool EnsureTexture(gl::GLContext* aGL, int aW, int aH);
  bool DestroyTexture(gl::GLContext* aGL);
  bool UsesGL(const gl::GLContext* aGL) const { return mGL.get() == aGL; }
  unsigned int Texture() const { return mTexture; }

 private:
  ~SuperResolutionSlotTextureHost();
  bool DeleteTexture();

  const int mSlot;
  RefPtr<gl::GLContext> mGL;
  unsigned int mTexture = 0;
  int mTexW = 0;
  int mTexH = 0;
};

}  // namespace zen
}  // namespace mozilla

#endif  // mozilla_zen_VideoSuperResolutionTexturePool_h
