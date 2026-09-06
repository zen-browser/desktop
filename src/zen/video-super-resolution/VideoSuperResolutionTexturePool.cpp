/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "VideoSuperResolutionTexturePool.h"

#include <cmath>

#include "GLBlitHelper.h"
#include "GLContext.h"
#include "ScopedGLHelpers.h"
#include "WebRenderAPI.h"
#include "mozilla/layers/AsyncImagePipelineManager.h"
#include "mozilla/layers/CompositorThread.h"
#include "mozilla/layers/CompositorVsyncScheduler.h"
#include "mozilla/layers/DMABUFSurfaceImage.h"
#include "mozilla/layers/WebRenderBridgeParent.h"
#include "mozilla/layers/WebRenderImageHost.h"
#include "mozilla/webrender/RenderThread.h"
#include "mozilla/webrender/WebRenderTypes.h"
#include "mozilla/widget/DMABufSurface.h"
#include "nsThreadUtils.h"

#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
#include "mozilla/StaticPrefs_zen.h"
#endif

#include "NvidiaVfxSession.h"
#include "VideoSuperResolutionCapability.h"
#include "VideoSuperResolutionCoordinator.h"
#include "VideoSuperResolutionOwnerPolicy.h"
#include "VideoSuperResolutionProfiler.h"
#include "VideoSuperResolutionScalePolicy.h"

namespace mozilla::zen {

VideoSuperResolutionTexturePool& VideoSuperResolutionTexturePool::Get() {
  static VideoSuperResolutionTexturePool sInstance;
  return sInstance;
}

VideoSuperResolutionTexturePool::VideoSuperResolutionTexturePool() = default;

RefPtr<NvidiaVfxSession> VideoSuperResolutionTexturePool::GetSession() {
  MutexAutoLock lock(mLock);
  return mSession;
}

CudaDeviceHandle VideoSuperResolutionTexturePool::GetGlCudaDevice() {
  MutexAutoLock lock(mLock);
  return mGlCudaDevice;
}

int VideoSuperResolutionTexturePool::GetCudaOrdinal() {
  MutexAutoLock lock(mLock);
  return mCudaOrdinal;
}

uint64_t VideoSuperResolutionTexturePool::GetContextGeneration(uint64_t aPipeline) {
  MutexAutoLock lock(mLock);
  return EnsurePipe(aPipeline).contextGeneration;
}

bool VideoSuperResolutionTexturePool::VfxEnabled() {
#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
  const bool enabled = StaticPrefs::zen_video_super_resolution_enabled();
  if (mLastVfxEnabled.exchange(enabled) != enabled) {
    MutexAutoLock lock(mLock);
    mSawCapabilityFailed = false;
    VideoSuperResolutionCapability::Get().Invalidate(nullptr);
  }
  return enabled;
#else
  return false;
#endif
}

bool VideoSuperResolutionTexturePool::CanClaimOwner(uint64_t aPipeline,
                                                     float aDisplayW,
                                                     float aDisplayH) {
  MutexAutoLock lock(mLock);
  if (aPipeline == 0 || !std::isfinite(aDisplayW) ||
      !std::isfinite(aDisplayH) || aDisplayW <= 0.0f || aDisplayH <= 0.0f) {
    return false;
  }

  SuperResolutionOwnerCandidate* candidate = nullptr;
  for (auto& c : mCandidates) {
    if (c.pipelineId == aPipeline) {
      candidate = &c;
      break;
    }
  }
  if (!candidate) {
    if (mCandidates.Length() >= 8) {
      for (size_t i = 0; i < mCandidates.Length(); ++i) {
        if (mCandidates[i].pipelineId != mCurrentOwner) {
          mCandidates.RemoveElementAt(i);
          break;
        }
      }
    }
    candidate = mCandidates.AppendElement(SuperResolutionOwnerCandidate{});
    candidate->pipelineId = aPipeline;
  }

  candidate->hasPresentationArea = true;
  const double area = double(aDisplayW) * double(aDisplayH);
  candidate->presentationArea =
      area >= double(UINT64_MAX) ? UINT64_MAX : static_cast<uint64_t>(area);
  candidate->eligible = true;

  if (mCurrentOwner == 0) {
    mCurrentOwner = aPipeline;
    mInputPipeline = aPipeline;
    return true;
  }

  if (mCurrentOwner == aPipeline) {
    return true;
  }

  const SuperResolutionOwnerCandidate* ownerCand = nullptr;
  for (const auto& c : mCandidates) {
    if (c.pipelineId == mCurrentOwner) {
      ownerCand = &c;
      break;
    }
  }

  SuperResolutionHandoffReason reason = SuperResolutionHandoffReason::None;
  if (VideoSuperResolutionOwnerPolicy::ShouldTakeOwnership(*candidate, ownerCand, &reason)) {
    const uint64_t oldOwner = mCurrentOwner;
    mCurrentOwner = aPipeline;
    mInputPipeline = aPipeline;
    mSnapshotRequests.Clear();
    mHasLastSnapshotRequest = false;
    for (size_t i = 0; i < mPipeSubmissions.Length();) {
      if (mPipeSubmissions[i].pipeline == oldOwner) {
        mPipeSubmissions.RemoveElementAt(i);
      } else {
        ++i;
      }
    }
    if (SuperResolutionProfilerActive()) {
      PROFILER_MARKER_FMT(kMarkerOwnerChange, GRAPHICS, {},
                          "old={} new={} reason={}", oldOwner, aPipeline,
                          SuperResolutionHandoffReasonToString(reason));
    }
    return true;
  }

  return false;
}

bool VideoSuperResolutionTexturePool::ShouldActivate(bool aIsHardwareBackend) {
  return aIsHardwareBackend && VfxEnabled();
}

bool VideoSuperResolutionTexturePool::IsAvailable(gl::GLContext* aGL) {
  if (!VfxEnabled() || !aGL) {
    return false;
  }
  if (!EnsureCudaDevice(aGL)) {
    return false;
  }
  return EnsureInitialized();
}

bool VideoSuperResolutionTexturePool::HasFailed() {
  RefPtr<NvidiaVfxSession> session;
  bool sawCapabilityFailed = false;
  {
    MutexAutoLock lock(mLock);
    session = mSession;
    sawCapabilityFailed = mSawCapabilityFailed;
  }
  if (session && session->State() == SuperResolutionSessionState::Failed) {
    return true;
  }
  return sawCapabilityFailed;
}

bool VideoSuperResolutionTexturePool::EnsureInitialized() {
  MutexAutoLock lock(mLock);
  if (!mSession) {
    mSession = new NvidiaVfxSession();
  }
  while (mSlots.Length() < mSlotCount) {
    const int index = (int)mSlots.Length();
    RefPtr<SuperResolutionSlotTextureHost> host =
        new SuperResolutionSlotTextureHost(index);
    const wr::ExternalImageId id =
        layers::AsyncImagePipelineManager::GetNextExternalImageId();
    RefPtr<wr::RenderTextureHost> base = host.get();
    wr::RenderThread::Get()->RegisterExternalImage(id, base.forget());
    mSlots.AppendElement(Slot{});
    mHosts.AppendElement(host);
    mExtIds.AppendElement(id);
  }
  return !mSlots.IsEmpty();
}

int VideoSuperResolutionTexturePool::SlotCount() {
  MutexAutoLock lock(mLock);
  return (int)mSlots.Length();
}

int VideoSuperResolutionTexturePool::FindFreeSlot() {
  mLock.AssertCurrentThreadOwns();
  for (size_t i = 0; i < mSlots.Length(); i++) {
    if (mSlots[i].state == SlotState::Free) {
      return (int)i;
    }
  }
  return -1;
}

int VideoSuperResolutionTexturePool::AcquireDownloadSlot(
    const SuperResolutionFrameToken& aToken, uint32_t aRenderer) {
  MutexAutoLock lock(mLock);
  for (size_t i = 0; i < mSlots.Length(); i++) {
    if (mSlots[i].state == SlotState::Ready && mSlots[i].token == aToken) {
      return (int)i;
    }
  }

  int slot = FindFreeSlot();

  if (slot < 0) {
    // Keep the displayed and retiring textures immutable. A ready result has
    // not reached the display yet, so replacing it favors the newer frame.
    for (size_t i = 0; i < mSlots.Length(); ++i) {
      if (mSlots[i].state == SlotState::Ready) {
        slot = static_cast<int>(i);
        mSlots[slot] = Slot{};
        break;
      }
    }
    if (slot < 0) {
      return -1;
    }
  }

  mSlots[slot].state = SlotState::Ready;
  mSlots[slot].token = aToken;
  mSlots[slot].renderer = aRenderer;
  mSlots[slot].contentReady = false;
  return slot;
}

int VideoSuperResolutionTexturePool::FindReadySlot(
    const SuperResolutionFrameToken& aToken, uint32_t aRenderer) {
  MutexAutoLock lock(mLock);
  for (size_t i = 0; i < mSlots.Length(); ++i) {
    const Slot& slot = mSlots[i];
    if ((slot.state == SlotState::Ready || slot.state == SlotState::Published) &&
        slot.contentReady && slot.token == aToken &&
        (!aRenderer || slot.renderer == aRenderer)) {
      return static_cast<int>(i);
    }
  }
  return -1;
}

void VideoSuperResolutionTexturePool::DiscardReady(int aSlot) {
  MutexAutoLock lock(mLock);
  if (aSlot < 0 || (size_t)aSlot >= mSlots.Length() ||
      mSlots[aSlot].state != SlotState::Ready) {
    return;
  }
  mSlots[aSlot] = Slot{};
}

bool VideoSuperResolutionTexturePool::Publish(
    uint64_t aPipeline, int aSlot, const SuperResolutionFrameToken& aToken,
    wr::ExternalImageId* aExtId) {
  MutexAutoLock lock(mLock);
  if (aSlot < 0 || (size_t)aSlot >= mSlots.Length()) {
    return false;
  }
  PipeDisplay& pipe = EnsurePipe(aPipeline);
  if (mSlots[aSlot].token.contextGeneration != pipe.contextGeneration) {
    return false;
  }
  if (mSlots[aSlot].renderer != pipe.renderer) {
    return false;
  }
  if (mSlots[aSlot].token != aToken) {
    return false;
  }
  if (!mSlots[aSlot].contentReady) {
    return false;
  }
  if (pipe.slot == aSlot) {
    if (aExtId) {
      *aExtId = mExtIds[aSlot];
    }
    return true;
  }
  if (mSlots[aSlot].state != SlotState::Ready &&
      mSlots[aSlot].state != SlotState::Published) {
    return false;
  }
  if (pipe.slot >= 0 && pipe.slot != aSlot) {
    RetireSlot(pipe, pipe.slot);
  }
  pipe.slot = aSlot;
  mSlots[aSlot].state = SlotState::Published;
  if (aExtId) {
    *aExtId = mExtIds[aSlot];
  }
  return true;
}

void VideoSuperResolutionTexturePool::Unpublish(uint64_t aPipeline) {
  MutexAutoLock lock(mLock);
  PipeDisplay* pipe = FindPipe(aPipeline);
  if (!pipe || pipe->slot < 0) {
    return;
  }
  RetireSlot(*pipe, pipe->slot);
  pipe->slot = -1;
  pipe->keyValid = false;
  pipe->keySlot = -1;
}

bool VideoSuperResolutionTexturePool::TryHoldPublished(
    uint64_t aPipeline, const SuperResolutionFrameToken& aCurrent,
    SuperResolutionFrameToken* aHeldToken) {
  MutexAutoLock lock(mLock);
  PipeDisplay* pipe = FindPipe(aPipeline);
  if (!pipe || pipe->slot < 0 || (size_t)pipe->slot >= mSlots.Length()) {
    return false;
  }
  const Slot& slot = mSlots[pipe->slot];
  if (slot.state != SlotState::Published || !slot.contentReady) {
    return false;
  }
  if (!aCurrent.MatchesStream(slot.token)) {
    return false;
  }
  const int64_t dist = static_cast<int64_t>(aCurrent.frame) -
                       static_cast<int64_t>(slot.token.frame);
  if (dist < 0 || dist > kMaxFrameLag) {
    return false;
  }
  if (aHeldToken) {
    *aHeldToken = slot.token;
  }
  return true;
}

VideoSuperResolutionTexturePool::PipeDisplay&
VideoSuperResolutionTexturePool::EnsurePipe(uint64_t aPipeline) {
  mLock.AssertCurrentThreadOwns();
  for (auto& p : mPipes) {
    if (p.pipeline == aPipeline) {
      return p;
    }
  }
  PipeDisplay* created = mPipes.AppendElement(PipeDisplay{});
  created->pipeline = aPipeline;
  created->contextGeneration = ++mNextContextGeneration;
  return *created;
}

VideoSuperResolutionTexturePool::PipeDisplay*
VideoSuperResolutionTexturePool::FindPipe(uint64_t aPipeline) {
  mLock.AssertCurrentThreadOwns();
  for (auto& p : mPipes) {
    if (p.pipeline == aPipeline) {
      return &p;
    }
  }
  return nullptr;
}

bool VideoSuperResolutionTexturePool::DisplayedElsewhere(int aSlot,
                                                          uint64_t aExceptPipeline) {
  mLock.AssertCurrentThreadOwns();
  for (const auto& p : mPipes) {
    if (p.pipeline != aExceptPipeline && p.slot == aSlot) {
      return true;
    }
  }
  return false;
}

void VideoSuperResolutionTexturePool::RetireSlot(PipeDisplay& aPipe, int aSlot,
                                                  uint64_t aEpoch) {
  mLock.AssertCurrentThreadOwns();
  if (aSlot < 0 || static_cast<size_t>(aSlot) >= mSlots.Length()) {
    return;
  }
  aPipe.retiringSlot = aSlot;
  if (DisplayedElsewhere(aSlot, aPipe.pipeline)) {
    return;
  }
  mSlots[aSlot].state = SlotState::Retiring;
  for (const auto& fence : mRetireFences) {
    if (fence.pipeline == aPipe.pipeline && fence.slot == aSlot) {
      return;
    }
  }
  RetireFence fence;
  fence.pipeline = aPipe.pipeline;
  fence.renderer = aPipe.renderer;
  fence.slot = aSlot;
  fence.epoch = aEpoch;
  mRetireFences.AppendElement(fence);
}

void VideoSuperResolutionTexturePool::BindPipelineImageHost(
    uint64_t aPipeline, const RefPtr<layers::WebRenderImageHost>& aHost,
    uint32_t aRenderer) {
  MutexAutoLock lock(mLock);
  PipeDisplay& pipe = EnsurePipe(aPipeline);
  pipe.imageHost = aHost;
  pipe.renderer = aRenderer;
}

void VideoSuperResolutionTexturePool::QueueCompositionWakeup(
    uint64_t aPipeline, const SuperResolutionFrameToken& aToken,
    bool aForcePollRender) {
  {
    MutexAutoLock lock(mLock);
    PipeDisplay* pipe = FindPipe(aPipeline);
    if (!pipe || !pipe->imageHost) {
      return;
    }
    bool& pending = aForcePollRender ? pipe->pollWakePending
                                     : pipe->presentationWakePending;
    if (pending) {
      return;
    }
    pending = true;
  }
  if (!layers::CompositorThread()) {
    MutexAutoLock lock(mLock);
    if (PipeDisplay* pipe = FindPipe(aPipeline)) {
      if (aForcePollRender) {
        pipe->pollWakePending = false;
      } else {
        pipe->presentationWakePending = false;
      }
    }
    return;
  }
  layers::CompositorThread()->Dispatch(NS_NewRunnableFunction(
      "VideoSuperResolutionTexturePool::ProcessCompositionWakeup",
      [aPipeline, aToken, aForcePollRender]() {
        VideoSuperResolutionTexturePool::Get().ProcessCompositionWakeup(
            aPipeline, aToken, aForcePollRender);
      }));
}

void VideoSuperResolutionTexturePool::ProcessCompositionWakeup(
    uint64_t aPipeline, const SuperResolutionFrameToken& aToken,
    bool aForcePollRender) {
  RefPtr<layers::WebRenderImageHost> imageHost;
  {
    MutexAutoLock lock(mLock);
    PipeDisplay* pipe = FindPipe(aPipeline);
    if (!pipe) {
      return;
    }
    bool& pending = aForcePollRender ? pipe->pollWakePending
                                     : pipe->presentationWakePending;
    if (!pending) {
      return;
    }
    pending = false;
    imageHost = pipe->imageHost;
  }
  if (!imageHost) {
    return;
  }
  if (aForcePollRender) {
    imageHost->RequestSuperResolutionRenderPoll();
  } else {
    bool recentlyComposited = false;
    {
      MutexAutoLock lock(mLock);
      PipeDisplay* pipe = FindPipe(aPipeline);
      if (pipe && !pipe->lastCompositeTime.IsNull()) {
        recentlyComposited =
            (TimeStamp::Now() - pipe->lastCompositeTime).ToMilliseconds() < 50.0;
      }
    }
    bool needSchedule =
        !recentlyComposited ||
        !VideoSuperResolutionCoordinator::Get().WasPresented(aPipeline, aToken);
    if (needSchedule) {
      imageHost->RequestSuperResolutionComposition();
    }
  }
}

void VideoSuperResolutionTexturePool::NotifyVfxStreamComplete(
    const SuperResolutionFrameToken& aToken) {
  uint64_t pipeline = 0;
  {
    MutexAutoLock lock(mLock);
    for (const auto& submission : mPipeSubmissions) {
      if (submission.token == aToken) {
        pipeline = submission.pipeline;
        break;
      }
    }
  }
  if (pipeline) {
    QueueCompositionWakeup(pipeline, aToken, /* aForcePollRender */ true);
  }
}

bool VideoSuperResolutionTexturePool::EnsureKeyResource(
    wr::TransactionBuilder& aTxn, bool aIsAdd, const wr::ImageKey& aKey,
    uint64_t aPipeline) {
  MutexAutoLock lock(mLock);
  PipeDisplay* pipe = FindPipe(aPipeline);
  if (!pipe || pipe->slot < 0) {
    return false;
  }
  if (!aIsAdd && pipe->keyValid && pipe->keySlot == pipe->slot) {
    return true;
  }
  const Slot& slot = mSlots[pipe->slot];
  if (slot.token.contextGeneration != pipe->contextGeneration ||
      slot.token.sessionGeneration == 0) {
    return false;
  }
  const gfx::IntSize size(slot.token.outputWidth, slot.token.outputHeight);
  if (size.width <= 0 || size.height <= 0) {
    return false;
  }
  wr::ImageDescriptor desc(size, wr::ImageFormat::RGBA8, wr::OpacityType::Opaque);
  auto imageType = wr::ExternalImageType::TextureHandle(wr::ImageBufferKind::Texture2D);
  if (aIsAdd) {
    aTxn.AddExternalImage(aKey, desc, mExtIds[pipe->slot], imageType, 0, false);
  } else {
    aTxn.UpdateExternalImage(aKey, desc, mExtIds[pipe->slot], imageType, 0, false);
  }
  pipe->keyValid = true;
  pipe->keySlot = pipe->slot;
  return true;
}

void VideoSuperResolutionTexturePool::ReleasePipeline(uint64_t aPipeline,
                                                      uint64_t aEpoch) {
  MutexAutoLock lock(mLock);
  for (size_t i = 0; i < mPipes.Length(); ++i) {
    if (mPipes[i].pipeline == aPipeline) {
      RetireSlot(mPipes[i], mPipes[i].slot, aEpoch);
      RetireSlot(mPipes[i], mPipes[i].retiringSlot, aEpoch);
      mPipes.RemoveElementAt(i);
      break;
    }
  }
  for (size_t i = 0; i < mCandidates.Length(); ++i) {
    if (mCandidates[i].pipelineId == aPipeline) {
      mCandidates.RemoveElementAt(i);
      break;
    }
  }
  if (mCurrentOwner == aPipeline || mInputPipeline == aPipeline) {
    mCurrentOwner = 0;
    mInputPipeline = 0;
    mSnapshotRequests.Clear();
    mHasLastSnapshotRequest = false;
  }
  for (size_t i = 0; i < mPipeSubmissions.Length();) {
    if (mPipeSubmissions[i].pipeline == aPipeline) {
      mPipeSubmissions.RemoveElementAt(i);
    } else {
      ++i;
    }
  }
}

void VideoSuperResolutionTexturePool::NoteTransaction(uint64_t aPipeline,
                                                      uint64_t aEpoch) {
  MutexAutoLock lock(mLock);
  for (auto& fence : mRetireFences) {
    if (fence.pipeline == aPipeline && fence.epoch == 0) {
      fence.epoch = aEpoch;
    }
  }
}

void VideoSuperResolutionTexturePool::NotePipelineComposite(uint64_t aPipeline) {
  MutexAutoLock lock(mLock);
  PipeDisplay* pipe = FindPipe(aPipeline);
  if (!pipe) {
    return;
  }
  pipe->lastCompositeTime = TimeStamp::Now();
}

void VideoSuperResolutionTexturePool::NotePipelineRendered(
    uint64_t aPipeline, uint64_t aEpoch, uint64_t aRenderedFrame,
    uint32_t aRenderer, uint64_t aCompletedFrame) {
  MutexAutoLock lock(mLock);
  for (auto& fence : mRetireFences) {
    if (fence.pipeline == aPipeline && fence.renderer == aRenderer &&
        fence.epoch <= aEpoch && fence.renderedFrame == 0) {
      fence.renderedFrame = aRenderedFrame;
    }
  }
  RecycleCompleted(aRenderer, aCompletedFrame);
}

void VideoSuperResolutionTexturePool::NotePipelineRemoved(
    uint64_t aPipeline, uint64_t aRenderedFrame, uint32_t aRenderer,
    uint64_t aCompletedFrame) {
  MutexAutoLock lock(mLock);
  for (auto& fence : mRetireFences) {
    if (fence.pipeline == aPipeline && fence.renderer == aRenderer &&
        fence.renderedFrame == 0) {
      fence.renderedFrame = aRenderedFrame;
    }
  }
  RecycleCompleted(aRenderer, aCompletedFrame);
}

void VideoSuperResolutionTexturePool::NoteCompletedRender(
    uint32_t aRenderer, uint64_t aCompletedFrame) {
  MutexAutoLock lock(mLock);
  RecycleCompleted(aRenderer, aCompletedFrame);
}

void VideoSuperResolutionTexturePool::OnRendererDestroyed(uint32_t aRenderer,
                                                          gl::GLContext* aGL) {
  if (!aRenderer) {
    return;
  }

  RefPtr<NvidiaVfxSession> session;
  AutoTArray<RefPtr<SuperResolutionSlotTextureHost>, 4> hosts;
  unsigned int stagingTex = 0;
  unsigned int stagingFbo = 0;
  {
    MutexAutoLock lock(mLock);
    for (size_t i = 0; i < mPipes.Length();) {
      if (mPipes[i].renderer != aRenderer) {
        ++i;
        continue;
      }
      const uint64_t pipeline = mPipes[i].pipeline;
      if (mCurrentOwner == pipeline || mInputPipeline == pipeline) {
        mCurrentOwner = 0;
        mInputPipeline = 0;
      }
      for (size_t candidate = 0; candidate < mCandidates.Length(); ++candidate) {
        if (mCandidates[candidate].pipelineId == pipeline) {
          mCandidates.RemoveElementAt(candidate);
          break;
        }
      }
      mPipes.RemoveElementAt(i);
    }
    for (size_t i = 0; i < mSlots.Length(); ++i) {
      const bool slotOwned = mSlots[i].renderer == aRenderer;
      const bool unusedOldContextHost =
          aGL && mSlots[i].state == SlotState::Free && i < mHosts.Length() &&
          mHosts[i] && static_cast<SuperResolutionSlotTextureHost*>(mHosts[i].get())
                           ->UsesGL(aGL);
      if (!slotOwned && !unusedOldContextHost) {
        continue;
      }
      if (slotOwned) {
        uint32_t survivingRenderer = 0;
        for (const auto& pipe : mPipes) {
          if (pipe.slot == static_cast<int>(i)) {
            survivingRenderer = pipe.renderer;
            break;
          }
        }
        if (survivingRenderer) {
          mSlots[i].renderer = survivingRenderer;
          continue;
        }
        mSlots[i] = Slot{};
      }
      if (i < mHosts.Length() && mHosts[i]) {
        hosts.AppendElement(
            static_cast<SuperResolutionSlotTextureHost*>(mHosts[i].get()));
      }
    }
    for (size_t i = 0; i < mPipeSubmissions.Length();) {
      uint64_t pipeline = mPipeSubmissions[i].pipeline;
      bool stillLive = false;
      for (const auto& pipe : mPipes) {
        if (pipe.pipeline == pipeline) {
          stillLive = true;
          break;
        }
      }
      if (stillLive) {
        ++i;
      } else {
        mPipeSubmissions.RemoveElementAt(i);
      }
    }
    for (size_t i = 0; i < mRetireFences.Length();) {
      if (mRetireFences[i].renderer == aRenderer) {
        mRetireFences.RemoveElementAt(i);
      } else {
        ++i;
      }
    }
    const bool ownsSession = mSessionRenderer == aRenderer || mCudaGL == aGL;
    if (ownsSession) {
      session = std::move(mSession);
      mSessionRenderer = 0;
      stagingTex = mStagingTex;
      stagingFbo = mStagingFbo;
      mStagingTex = 0;
      mStagingFbo = 0;
      mStagingW = 0;
      mStagingH = 0;
      mPipeSubmissions.Clear();
      mSnapshotRequests.Clear();
      mSourceSurfaces.Clear();
      mHasLastSnapshotRequest = false;
       mGlCudaDevice = -1;
       mCudaOrdinal = -1;
       mCudaGL = nullptr;
       mSawCapabilityFailed = false;
       mSessionGeneration = 0;
    }
  }

  if (session) {
    session->Shutdown();
  }

  bool glCleanupComplete = true;
  if (aGL && aGL->MakeCurrent()) {
    for (auto& host : hosts) {
      if (host) {
        glCleanupComplete = host->DestroyTexture(aGL) && glCleanupComplete;
      }
    }
    if (stagingTex || stagingFbo) {
      glCleanupComplete =
          DeleteStagingResources(aGL, stagingTex, stagingFbo) && glCleanupComplete;
    }
  } else if (!hosts.IsEmpty() || stagingTex || stagingFbo) {
    glCleanupComplete = false;
  }
  if (glCleanupComplete && aGL) {
    VideoSuperResolutionCapability::Get().Invalidate(aGL);
  }
  if (SuperResolutionProfilerActive()) {
    PROFILER_MARKER_FMT(kMarkerContextReset, GRAPHICS, {},
                        "renderer={}", aRenderer);
  }
}

void VideoSuperResolutionTexturePool::RecycleCompleted(uint32_t aRenderer,
                                                      uint64_t aCompletedFrame) {
  for (size_t i = 0; i < mRetireFences.Length();) {
    const RetireFence& fence = mRetireFences[i];
    if (fence.renderer != aRenderer || fence.renderedFrame == 0 ||
        fence.renderedFrame > aCompletedFrame) {
      ++i;
      continue;
    }
    const int slot = fence.slot;
    mRetireFences.RemoveElementAt(i);
    bool stillFenced = false;
    for (const auto& remaining : mRetireFences) {
      if (remaining.slot == slot) {
        stillFenced = true;
        break;
      }
    }
    if (stillFenced) {
      continue;
    }
    if (slot >= 0 && (size_t)slot < mSlots.Length() &&
        mSlots[slot].state == SlotState::Retiring) {
      mSlots[slot] = Slot{};
    }
  }
}

uint64_t VideoSuperResolutionTexturePool::GetSessionGeneration() {
  MutexAutoLock lock(mLock);
  return mSessionGeneration;
}

bool VideoSuperResolutionTexturePool::UnregisterSlotTexture(unsigned int aTex) {
  RefPtr<NvidiaVfxSession> session;
  {
    MutexAutoLock lock(mLock);
    session = mSession;
  }
  if (!session) {
    return true;
  }
  return session->UnregisterTexture(aTex);
}

void VideoSuperResolutionTexturePool::InvalidateSlot(int aSlot) {
  MutexAutoLock lock(mLock);
  InvalidateSlotLocked(aSlot);
}

void VideoSuperResolutionTexturePool::InvalidateSlotLocked(int aSlot) {
  mLock.AssertCurrentThreadOwns();
  if (aSlot < 0 || (size_t)aSlot >= mSlots.Length()) {
    return;
  }
  const SlotState state = mSlots[aSlot].state;
  mSlots[aSlot].contentReady = false;
  for (auto& pipe : mPipes) {
    if (pipe.keySlot == aSlot) {
      pipe.keySlot = -1;
      pipe.keyValid = false;
    }
  }
  if (state == SlotState::Published || state == SlotState::Retiring) {
    for (auto& pipe : mPipes) {
      if (pipe.retiringSlot == aSlot) {
        pipe.retiringSlot = -1;
      }
    }
    return;
  }
  for (auto& pipe : mPipes) {
    if (pipe.slot == aSlot) {
      pipe.slot = -1;
    }
    if (pipe.retiringSlot == aSlot) {
      pipe.retiringSlot = -1;
    }
  }
  mSlots[aSlot] = Slot{};
  for (size_t i = 0; i < mRetireFences.Length();) {
    if (mRetireFences[i].slot == aSlot) {
      mRetireFences.RemoveElementAt(i);
    } else {
      ++i;
    }
  }
}

void VideoSuperResolutionTexturePool::PollVfxResults(gl::GLContext* aGL) {
#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
  if (!StaticPrefs::zen_video_super_resolution_enabled()) {
    return;
  }
#endif
  if (!IsAvailable(aGL)) {
    return;
  }
  PollSessionDownloads(aGL);
}

void VideoSuperResolutionTexturePool::RequestSnapshot(
    const SuperResolutionFrameToken& aToken, uint64_t aPipeline,
    uint64_t aSourceIdentity) {
  bool needWakeup = false;
  {
    MutexAutoLock lock(mLock);
    if (!aToken.HasIdentity()) {
      return;
    }
    PipeDisplay& pipe = EnsurePipe(aPipeline);
    if (aToken.contextGeneration != pipe.contextGeneration) {
      return;
    }
    if (!aSourceIdentity) {
      return;
    }
    if (mInputPipeline && mInputPipeline != aPipeline) {
      return;
    }
    mInputPipeline = aPipeline;
    if (mHasLastSnapshotRequest && mLastSnapshotPipeline == aPipeline &&
        mLastSnapshotRequest == aToken) {
      return;
    }
    mLastSnapshotRequest = aToken;
    mLastSnapshotPipeline = aPipeline;
    mHasLastSnapshotRequest = true;
    for (size_t i = 0; i < mSnapshotRequests.Length();) {
      if (mSnapshotRequests[i].pipeline == aPipeline) {
        mSnapshotRequests.RemoveElementAt(i);
      } else {
        ++i;
      }
    }
    SnapshotRequest req;
    req.token = aToken;
    req.pipeline = aPipeline;
    req.sourceIdentity = aSourceIdentity;
    mSnapshotRequests.AppendElement(req);
    needWakeup = true;
    MarkToken(kMarkerSnapshot, aToken);

    if (mOutW != aToken.outputWidth || mOutH != aToken.outputHeight) {
      for (size_t i = 0; i < mSlots.Length(); ++i) {
        if (mSlots[i].state == SlotState::Ready) {
          mSlots[i] = Slot{};
        }
      }
      mOutW = aToken.outputWidth;
      mOutH = aToken.outputHeight;
    }
  }

  if (needWakeup) {
    QueueCompositionWakeup(aPipeline, aToken, /* aForcePollRender */ true);
  }
}

void VideoSuperResolutionTexturePool::RegisterSourceSurface(
    uint64_t aIdentity, DMABufSurface* aSurface) {
  if (!aIdentity || !aSurface) {
    return;
  }
  uint64_t pipeline = 0;
  SuperResolutionFrameToken token;
  {
    MutexAutoLock lock(mLock);
    bool found = false;
    for (auto& entry : mSourceSurfaces) {
      if (entry.identity == aIdentity) {
        entry.surface = aSurface;
        found = true;
        break;
      }
    }
    if (!found) {
      if (mSourceSurfaces.Length() >= kMaxSourceSurfaces) {
        mSourceSurfaces.RemoveElementAt(0);
      }
      mSourceSurfaces.AppendElement(SourceSurfaceEntry{aIdentity, aSurface});
    }

    for (const auto& request : mSnapshotRequests) {
      if (request.sourceIdentity == aIdentity) {
        pipeline = request.pipeline;
        token = request.token;
        break;
      }
    }
  }
  if (pipeline) {
    QueueCompositionWakeup(pipeline, token, /* aForcePollRender */ true);
  }
}

void VideoSuperResolutionTexturePool::UnregisterSourceSurface(
    uint64_t aIdentity, DMABufSurface* aSurface) {
  if (!aIdentity || !aSurface) {
    return;
  }
  MutexAutoLock lock(mLock);
  for (size_t i = 0; i < mSourceSurfaces.Length(); ++i) {
    if (mSourceSurfaces[i].identity == aIdentity &&
        mSourceSurfaces[i].surface == aSurface) {
      mSourceSurfaces.RemoveElementAt(i);
      return;
    }
  }
}

void VideoSuperResolutionTexturePool::ProcessPendingSnapshots(gl::GLContext* aGL) {
#if defined(XP_LINUX) && defined(MOZ_WIDGET_GTK)
  if (!StaticPrefs::zen_video_super_resolution_enabled()) {
    return;
  }
#endif
  if (!IsAvailable(aGL)) {
    uint64_t pipeline = 0;
    SuperResolutionFrameToken token;
    {
      MutexAutoLock lock(mLock);
      if (!mSnapshotRequests.IsEmpty()) {
        const SnapshotRequest& request = mSnapshotRequests.LastElement();
        pipeline = request.pipeline;
        token = request.token;
        mSnapshotRequests.Clear();
      }
    }
    if (pipeline) {
      QueueCompositionWakeup(pipeline, token, /* aForcePollRender */ false);
    }
    return;
  }
  RefPtr<DMABufSurface> surface;
  uint64_t sourceIdentity = 0;
  {
    MutexAutoLock lock(mLock);
    if (mSnapshotRequests.IsEmpty()) {
      return;
    }
    for (int i = (int)mSnapshotRequests.Length() - 1; i >= 0; --i) {
      const auto& req = mSnapshotRequests[i];
      for (const auto& entry : mSourceSurfaces) {
        if (entry.identity == req.sourceIdentity && entry.surface) {
          surface = entry.surface;
          sourceIdentity = req.sourceIdentity;
          if (i > 0) {
            mSnapshotRequests.RemoveElementsAt(0, (size_t)i);
          }
          break;
        }
      }
      if (surface) {
        break;
      }
    }
  }
  if (surface) {
    SnapshotFromSurface(surface, aGL, sourceIdentity);
  }
}

void VideoSuperResolutionTexturePool::SnapshotFromSurface(
    DMABufSurface* aSurface, gl::GLContext* aGL, uint64_t aSourceIdentity) {
  using namespace gl;
  SuperResolutionFrameToken request;
  uint64_t pipeline = 0;
  {
    MutexAutoLock lock(mLock);
    const uint64_t sourceIdentity = aSourceIdentity;
    size_t requestIndex = mSnapshotRequests.Length();
    for (size_t i = 0; i < mSnapshotRequests.Length(); ++i) {
      if (mSnapshotRequests[i].sourceIdentity == sourceIdentity) {
        requestIndex = i;
        break;
      }
    }
    if (requestIndex == mSnapshotRequests.Length()) {
      return;
    }
    request = mSnapshotRequests[requestIndex].token;
    pipeline = mSnapshotRequests[requestIndex].pipeline;
    mSnapshotRequests.RemoveElementAt(requestIndex);
    PipeDisplay* pipe = FindPipe(pipeline);
    if (!pipe || request.contextGeneration != pipe->contextGeneration ||
        mInputPipeline != pipeline) {
      return;
    }
  }

  if (!aSurface || !aGL || !aGL->MakeCurrent()) {
    return;
  }

  const int w = aSurface->GetWidth();
  const int h = aSurface->GetHeight();
  if (aSurface->GetFormat() != gfx::SurfaceFormat::NV12 ||
      aSurface->IsHDRSurface() || w <= 0 || h <= 0 || w > 4096 || h > 4096 ||
      w != request.sourceWidth || h != request.sourceHeight ||
      request.outputWidth <= 0 || request.outputHeight <= 0 ||
      request.outputWidth > VideoSuperResolutionScalePolicy::kMaxOutputWidth ||
      request.outputHeight > VideoSuperResolutionScalePolicy::kMaxOutputHeight) {
    return;
  }

  bool needAlloc = false;
  {
    MutexAutoLock lock(mLock);
    needAlloc = (mStagingTex == 0 || mStagingW != w || mStagingH != h);
  }
  unsigned int tex = 0;
  unsigned int fbo = 0;
  {
    MutexAutoLock lock(mLock);
    tex = mStagingTex;
    fbo = mStagingFbo;
  }
  if (needAlloc) {
    bool createdTexture = false;
    bool createdFbo = false;
    if (tex == 0) {
      aGL->fGenTextures(1, &tex);
      createdTexture = true;
    }
    aGL->fBindTexture(LOCAL_GL_TEXTURE_2D, tex);
    aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_MIN_FILTER, LOCAL_GL_LINEAR);
    aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_MAG_FILTER, LOCAL_GL_LINEAR);
    aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_WRAP_S, LOCAL_GL_CLAMP_TO_EDGE);
    aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_WRAP_T, LOCAL_GL_CLAMP_TO_EDGE);
    aGL->fTexImage2D(LOCAL_GL_TEXTURE_2D, 0, LOCAL_GL_RGBA8, w, h, 0,
                     LOCAL_GL_RGBA, LOCAL_GL_UNSIGNED_BYTE, nullptr);
    if (fbo == 0) {
      aGL->fGenFramebuffers(1, &fbo);
      createdFbo = true;
    }
    {
      ScopedBindFramebuffer bind(aGL, fbo);
      aGL->fFramebufferTexture2D(LOCAL_GL_FRAMEBUFFER, LOCAL_GL_COLOR_ATTACHMENT0,
                                LOCAL_GL_TEXTURE_2D, tex, 0);
      if (aGL->fCheckFramebufferStatus(LOCAL_GL_FRAMEBUFFER) !=
          LOCAL_GL_FRAMEBUFFER_COMPLETE) {
        aGL->fBindTexture(LOCAL_GL_TEXTURE_2D, 0);
        if (createdFbo && fbo) {
          aGL->fDeleteFramebuffers(1, &fbo);
        }
        if (createdTexture && tex) {
          aGL->fDeleteTextures(1, &tex);
        }
        return;
      }
    }
    aGL->fBindTexture(LOCAL_GL_TEXTURE_2D, 0);
    {
      MutexAutoLock lock(mLock);
      mStagingTex = tex;
      mStagingFbo = fbo;
      mStagingW = w;
      mStagingH = h;
    }
  }

  const int planeCount = aSurface->GetTextureCount();
  for (int i = 0; i < planeCount; ++i) {
    if (auto texture = aSurface->GetTexture(i)) {
      aSurface->MaybeSemaphoreWait(texture);
    }
  }

  GLBlitHelper* blit = aGL->BlitHelper();
  if (!blit) {
    return;
  }

  {
    ScopedBindFramebuffer bind(aGL, fbo);
    ScopedViewportRect view(aGL, 0, 0, w, h);
    const bool blitOk = blit->Blit(aSurface, gfx::IntRect(0, 0, w, h),
                                   gl::OriginPos::TopLeft);
    if (!blitOk) {
      return;
    }
  }

  if (!IsAvailable(aGL)) {
    return;
  }
  RefPtr<NvidiaVfxSession> session = GetSession();
  if (!session) {
    return;
  }
  const SuperResolutionConfig config =
      VideoSuperResolutionScalePolicy::ReadConfigFromPrefs();
  CudaDeviceHandle glCudaDevice = GetGlCudaDevice();
  int cudaOrdinal = GetCudaOrdinal();
  const uint64_t gen = session->EnsureWorker(
      w, h, request.outputWidth, request.outputHeight,
      config.quality, glCudaDevice, cudaOrdinal);
  {
    MutexAutoLock lock(mLock);
    if (gen != mSessionGeneration) {
      mSessionGeneration = gen;
    }
  }
  if (gen == 0) {
    return;
  }
  {
    MutexAutoLock lock(mLock);
    if (PipeDisplay* pipe = FindPipe(pipeline)) {
      mSessionRenderer = pipe->renderer;
    }
  }
  if (request.sessionGeneration != gen) {
    request.sessionGeneration = gen;
    MutexAutoLock lock(mLock);
    for (auto& submission : mPipeSubmissions) {
      if (submission.pipeline == pipeline &&
          submission.token.producer == request.producer &&
          submission.token.frame == request.frame) {
        submission.token = request;
        break;
      }
    }
  }
  PollSessionDownloads(aGL);
  unsigned int stagingTex = 0;
  {
    MutexAutoLock lock(mLock);
    stagingTex = mStagingTex;
  }
  {
    MutexAutoLock lock(mLock);
    for (size_t i = 0; i < mPipeSubmissions.Length();) {
      if (mPipeSubmissions[i].token == request) {
        mPipeSubmissions.RemoveElementAt(i);
      } else {
        ++i;
      }
    }
    if (mPipeSubmissions.Length() >= 2) {
      mPipeSubmissions.RemoveElementAt((size_t)0);
    }
    PipeSubmission submission;
    submission.pipeline = pipeline;
    submission.token = request;
    mPipeSubmissions.AppendElement(submission);
  }
  if (session->SubmitInput(request, stagingTex, w, h)) {
    MarkToken(kMarkerSubmit, request);
  } else {
    MutexAutoLock lock(mLock);
    for (size_t i = 0; i < mPipeSubmissions.Length(); ++i) {
      if (mPipeSubmissions[i].pipeline == pipeline &&
          mPipeSubmissions[i].token == request) {
        mPipeSubmissions.RemoveElementAt(i);
        break;
      }
    }
  }
}

bool VideoSuperResolutionTexturePool::IsSlotReady(int aSlot) {
  MutexAutoLock lock(mLock);
  if (aSlot < 0 || (size_t)aSlot >= mSlots.Length()) {
    return false;
  }
  return mSlots[aSlot].contentReady &&
         (mSlots[aSlot].state == SlotState::Ready ||
          mSlots[aSlot].state == SlotState::Published ||
          mSlots[aSlot].state == SlotState::Retiring);
}

bool VideoSuperResolutionTexturePool::EnsureCudaDevice(gl::GLContext* aGL) {
  if (!aGL) {
    return false;
  }
  VideoSuperResolutionCapability& cap = VideoSuperResolutionCapability::Get();
  RefPtr<gl::GLContext> cudaGL;
  {
    MutexAutoLock lock(mLock);
    cudaGL = mCudaGL;
  }
  if (cudaGL && cudaGL.get() != aGL) {
    return false;
  }
  if (cap.GetState() == SuperResolutionCapabilityState::Available &&
      cudaGL.get() == aGL) {
    return true;
  }
  if (cap.GetState() == SuperResolutionCapabilityState::Failed) {
    MutexAutoLock lock(mLock);
    mSawCapabilityFailed = true;
    return false;
  }
  if (!cap.Probe(aGL)) {
    MutexAutoLock lock(mLock);
    mGlCudaDevice = -1;
    mCudaOrdinal = -1;
    mSawCapabilityFailed = true;
    return false;
  }
  MutexAutoLock lock(mLock);
  mGlCudaDevice = cap.GetGlCudaDevice();
  mCudaOrdinal = cap.GetCudaOrdinal();
  mCudaGL = aGL;
  mSawCapabilityFailed = false;
  return true;
}

bool VideoSuperResolutionTexturePool::DeleteStagingResources(
    gl::GLContext* aGL, unsigned int aTexture, unsigned int aFbo) {
  if (!aGL || !aGL->MakeCurrent()) {
    return false;
  }
  if (aFbo) {
    aGL->fDeleteFramebuffers(1, &aFbo);
  }
  if (aTexture) {
    aGL->fDeleteTextures(1, &aTexture);
  }
  return true;
}

void VideoSuperResolutionTexturePool::PollSessionDownloads(gl::GLContext* aGL) {
  RefPtr<NvidiaVfxSession> session = GetSession();
  if (!session) {
    return;
  }
  SuperResolutionFrameToken ready;
  if (!session->PeekReady(&ready) || !ready.HasIdentity()) {
    return;
  }
  uint64_t pipe = 0;
  {
    MutexAutoLock lock(mLock);
    for (const auto& submission : mPipeSubmissions) {
      if (submission.token == ready) {
        pipe = submission.pipeline;
        break;
      }
    }
  }
  if (!pipe) {
    SuperResolutionFrameToken dropped;
    session->TakeReady(&dropped);
    MarkToken(kMarkerDrop, dropped, "no-submission-route");
    return;
  }
  if (ready.contextGeneration != GetContextGeneration(pipe)) {
    SuperResolutionFrameToken dropped;
    session->TakeReady(&dropped);
    MarkToken(kMarkerDrop, dropped, "context-changed");
    return;
  }
  if (!session->IsReadyComplete()) {
    return;
  }
  int slot = AcquireDownloadSlot(ready, mSessionRenderer);
  if (slot < 0) {
    return;
  }
  SuperResolutionSlotTextureHost* host = nullptr;
  {
    MutexAutoLock lock(mLock);
    if ((size_t)slot < mHosts.Length()) {
      host = static_cast<SuperResolutionSlotTextureHost*>(mHosts[slot].get());
    }
  }
  if (!host || !host->EnsureTexture(aGL, ready.outputWidth, ready.outputHeight)) {
    DiscardReady(slot);
    SuperResolutionFrameToken dropped;
    session->TakeReady(&dropped);
    MarkToken(kMarkerDrop, dropped, "output-texture-unavailable");
    return;
  }
  if (!session->DownloadSlot((size_t)slot, host->Texture(),
                             ready.outputWidth, ready.outputHeight)) {
    DiscardReady(slot);
    SuperResolutionFrameToken dropped;
    session->TakeReady(&dropped);
    MarkToken(kMarkerDrop, dropped, "output-download-failed");
    return;
  }
  {
    MutexAutoLock lock(mLock);
    if ((size_t)slot < mSlots.Length() &&
        mSlots[slot].state == SlotState::Ready &&
        mSlots[slot].token == ready) {
      mSlots[slot].contentReady = true;
    } else {
      return;
    }
  }
  SuperResolutionFrameToken taken;
  session->TakeReady(&taken);
  if (!(taken == ready)) {
    InvalidateSlot(slot);
    return;
  }
  {
    MutexAutoLock lock(mLock);
    for (size_t i = 0; i < mPipeSubmissions.Length(); ++i) {
      if (mPipeSubmissions[i].token == taken) {
        mPipeSubmissions.RemoveElementAt(i);
        break;
      }
    }
  }
  if (!VideoSuperResolutionCoordinator::Get().NoteExternalCompleted(pipe, taken)) {
    DiscardReady(slot);
    MarkToken(kMarkerDrop, taken, "stale-result");
  } else {
    MarkToken(kMarkerComplete, taken);
    QueueCompositionWakeup(pipe, taken, /* aForcePollRender */ false);
  }
}

bool VideoSuperResolutionTexturePool::GetSlotToken(int aSlot,
                                                   SuperResolutionFrameToken* aOut) {
  MutexAutoLock lock(mLock);
  if (aSlot < 0 || (size_t)aSlot >= mSlots.Length()) {
    return false;
  }
  if (!mSlots[aSlot].token.HasIdentity()) {
    return false;
  }
  if (aOut) {
    *aOut = mSlots[aSlot].token;
  }
  return true;
}

SuperResolutionSlotTextureHost::SuperResolutionSlotTextureHost(int aSlot)
    : mSlot(aSlot) {
  MOZ_COUNT_CTOR_INHERITED(SuperResolutionSlotTextureHost, RenderTextureHost);
}

SuperResolutionSlotTextureHost::~SuperResolutionSlotTextureHost() {
  MOZ_COUNT_DTOR_INHERITED(SuperResolutionSlotTextureHost, RenderTextureHost);
  DeleteTexture();
}

wr::WrExternalImage SuperResolutionSlotTextureHost::Lock(uint8_t aChannelIndex,
                                                        gl::GLContext* aGL) {
  if (aChannelIndex != 0 || !aGL || !aGL->MakeCurrent()) {
    return wr::InvalidToWrExternalImage();
  }
  if (mGL && mGL.get() != aGL) {
    VideoSuperResolutionTexturePool::Get().InvalidateSlot(mSlot);
    return wr::InvalidToWrExternalImage();
  }
  SuperResolutionFrameToken token;
  if (!VideoSuperResolutionTexturePool::Get().GetSlotToken(mSlot, &token)) {
    return wr::InvalidToWrExternalImage();
  }
  if (token.sessionGeneration == 0 ||
      !VideoSuperResolutionTexturePool::Get().IsSlotReady(mSlot) || !mTexture ||
      mTexW != token.outputWidth || mTexH != token.outputHeight) {
    return wr::InvalidToWrExternalImage();
  }
  return wr::NativeTextureToWrExternalImage(
      mTexture, 0.0f, 0.0f, (float)mTexW, (float)mTexH);
}

void SuperResolutionSlotTextureHost::ClearCachedResources() {
  if (DeleteTexture()) {
    mGL = nullptr;
  }
  VideoSuperResolutionTexturePool::Get().InvalidateSlot(mSlot);
}

size_t SuperResolutionSlotTextureHost::Bytes() {
  return static_cast<size_t>(mTexW) * static_cast<size_t>(mTexH) * 4;
}

bool SuperResolutionSlotTextureHost::DestroyTexture(gl::GLContext* aGL) {
  if (!aGL || (mGL && mGL.get() != aGL) || !aGL->MakeCurrent()) {
    return false;
  }
  if (!DeleteTexture()) {
    return false;
  }
  mGL = nullptr;
  return true;
}

bool SuperResolutionSlotTextureHost::DeleteTexture() {
  if (mTexture) {
    if (!mGL || !mGL->MakeCurrent() ||
        !VideoSuperResolutionTexturePool::Get().UnregisterSlotTexture(mTexture)) {
      return false;
    }
    mGL->fDeleteTextures(1, &mTexture);
  }
  mTexture = 0;
  mTexW = 0;
  mTexH = 0;
  return true;
}

bool SuperResolutionSlotTextureHost::EnsureTexture(gl::GLContext* aGL, int aW, int aH) {
  using namespace gl;
  if (!aGL || !aGL->MakeCurrent()) {
    return false;
  }
  if (mGL && mGL.get() != aGL) {
    return false;
  }
  mGL = aGL;
  if (aW <= 0 || aH <= 0 || aW > 7680 || aH > 4320) {
    return false;
  }
  if (mTexture && mTexW == aW && mTexH == aH) {
    return true;
  }
  unsigned int tex = 0;
  aGL->fGenTextures(1, &tex);
  aGL->fBindTexture(LOCAL_GL_TEXTURE_2D, tex);
  aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_MIN_FILTER, LOCAL_GL_LINEAR);
  aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_MAG_FILTER, LOCAL_GL_LINEAR);
  aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_WRAP_S, LOCAL_GL_CLAMP_TO_EDGE);
  aGL->fTexParameteri(LOCAL_GL_TEXTURE_2D, LOCAL_GL_TEXTURE_WRAP_T, LOCAL_GL_CLAMP_TO_EDGE);
  aGL->fTexImage2D(LOCAL_GL_TEXTURE_2D, 0, LOCAL_GL_RGBA8, aW, aH, 0,
                   LOCAL_GL_RGBA, LOCAL_GL_UNSIGNED_BYTE, nullptr);
  aGL->fBindTexture(LOCAL_GL_TEXTURE_2D, 0);
  if (!tex) {
    return false;
  }
  if (mTexture) {
    if (!VideoSuperResolutionTexturePool::Get().UnregisterSlotTexture(mTexture)) {
      aGL->fDeleteTextures(1, &tex);
      return false;
    }
    aGL->fDeleteTextures(1, &mTexture);
  }
  mTexture = tex;
  mTexW = aW;
  mTexH = aH;
  return true;
}

}  // namespace mozilla::zen
