/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "NvidiaVfxSession.h"

#include <iterator>

#include "CudaGlInterop.h"
#include "GLContext.h"
#include "mozilla/Logging.h"
#include "NvidiaVfxLoader.h"
#include "VideoSuperResolutionProfiler.h"
#include "VideoSuperResolutionTexturePool.h"
#include "nsCOMPtr.h"
#include "nsIRunnable.h"
#include "nsIThread.h"
#include "nsIThreadManager.h"
#include "nsThreadUtils.h"

namespace mozilla::zen {

static LazyLogModule sVideoSuperResolutionLog("VideoSuperResolution");

struct CompletionSignal {
  SuperResolutionFrameToken token;
};

static void OnStreamComplete(void* aUserData) {
  auto* signal = static_cast<CompletionSignal*>(aUserData);
  if (!signal) {
    return;
  }
  VideoSuperResolutionTexturePool::Get().NotifyVfxStreamComplete(signal->token);
  delete signal;
}

NvidiaVfxSession::NvidiaVfxSession() = default;

NvidiaVfxSession::~NvidiaVfxSession() {
  MOZ_ASSERT(mState == SuperResolutionSessionState::Uninitialized ||
             mState == SuperResolutionSessionState::Failed);
}

SuperResolutionSessionState NvidiaVfxSession::State() const {
  MonitorAutoLock lock(mLock);
  return mState;
}

void NvidiaVfxSession::FailLocked(const char* aWhere) {
  mLock.AssertCurrentThreadOwns();
  if (mState != SuperResolutionSessionState::Failed) {
    MOZ_LOG(sVideoSuperResolutionLog, LogLevel::Warning,
            ("VSR disabled after %s failure", aWhere));
  }
  mState = SuperResolutionSessionState::Failed;
  mEffectReady = false;
}

uint64_t NvidiaVfxSession::EnsureWorker(
    int aVideoW, int aVideoH, int aOutW, int aOutH,
    SuperResolutionQuality aQuality, CuDevice aGlCudaDevice, int aCudaOrdinal) {
  if (aVideoW < 160 || aVideoH < 90 || aVideoW > 3840 || aVideoH > 2160 ||
      aOutW <= 0 || aOutH <= 0 || aOutW > 7680 || aOutH > 4320 ||
      aGlCudaDevice < 0 || aCudaOrdinal < 0) {
    return 0;
  }

  uint64_t generation = 0;
  bool needSpawn = false;
  bool dispatchRebind = false;
  nsCOMPtr<nsIThread> worker;
  {
    MonitorAutoLock lock(mLock);
    if (mState == SuperResolutionSessionState::ShuttingDown ||
        mState == SuperResolutionSessionState::Failed) {
      return 0;
    }

    const bool sameBinding =
        mVideoW == aVideoW && mVideoH == aVideoH && mOutW == aOutW &&
        mOutH == aOutH && mGlCudaDevice == aGlCudaDevice &&
        mCudaOrdinal == aCudaOrdinal;

    if (sameBinding) {
      if (mRequestedQuality != aQuality) {
        mRequestedQuality = aQuality;
      }
      if (mState == SuperResolutionSessionState::Ready) {
        return mGeneration;
      }
      return mState == SuperResolutionSessionState::Loading ? mGeneration : 0;
    }

    mVideoW = aVideoW;
    mVideoH = aVideoH;
    mOutW = aOutW;
    mOutH = aOutH;
    mRequestedQuality = aQuality;
    mGlCudaDevice = aGlCudaDevice;
    mCudaOrdinal = aCudaOrdinal;
    mHasReady = false;
    mWorkerBusy = false;
    mEffectReady = false;
    mState = SuperResolutionSessionState::Loading;
    generation = ++mGeneration;
    needSpawn = !mWorkerThread;
    if (!mRebindQueued) {
      mRebindQueued = true;
      dispatchRebind = true;
    }
  }

  UnregisterAllGl();
  RefPtr<NvidiaVfxSession> self = this;
  if (needSpawn) {
    nsIThreadManager::ThreadCreationOptions opts;
    opts.stackSize = 8 * 1024 * 1024;
    nsCOMPtr<nsIThread> thread;
    nsresult rv = NS_NewNamedThread(
        "VfxWorker", getter_AddRefs(thread), nullptr, opts);
    if (NS_FAILED(rv) || !thread) {
      MonitorAutoLock lock(mLock);
      FailLocked("spawn worker thread");
      return 0;
    }
    {
      MonitorAutoLock lock(mLock);
      mWorkerThread = thread;
      worker = mWorkerThread;
    }
    if (NS_FAILED(worker->Dispatch(
        NS_NewRunnableFunction("WorkerInit", [self]() { self->WorkerInit(); }),
        NS_DISPATCH_NORMAL))) {
      MonitorAutoLock lock(mLock);
      mRebindQueued = false;
      FailLocked("dispatch worker init");
      return 0;
    }
  } else if (dispatchRebind) {
    {
      MonitorAutoLock lock(mLock);
      worker = mWorkerThread;
    }
    if (!worker || NS_FAILED(worker->Dispatch(
        NS_NewRunnableFunction("WorkerRebind", [self]() { self->WorkerRebind(); }),
        NS_DISPATCH_NORMAL))) {
      MonitorAutoLock lock(mLock);
      mRebindQueued = false;
      FailLocked("dispatch worker rebind");
      return 0;
    }
  }

  return generation;
}

bool NvidiaVfxSession::SubmitInput(const SuperResolutionFrameToken& aToken,
                                   unsigned int aStagingTex, int aStagingW,
                                   int aStagingH) {
  if (!aToken.HasIdentity() || aStagingTex == 0 || aStagingW <= 0 ||
      aStagingH <= 0) {
    return false;
  }

  nsCOMPtr<nsIThread> worker;
  {
    MonitorAutoLock lock(mLock);
    if (mState != SuperResolutionSessionState::Ready || !mEffectReady) {
      return false;
    }
    if (mGeneration != aToken.sessionGeneration) {
      return false;
    }
    if (mVideoW != aStagingW || mVideoH != aStagingH) {
      return false;
    }
    if (mWorkerBusy) {
      return false;
    }
    if (mHasReady) {
      return false;
    }
    mWorkerBusy = true;
    mWorkingToken = aToken;
    worker = mWorkerThread;
  }

  if (!MapAndCopyToInput(aStagingTex, aStagingW, aStagingH)) {
    MonitorAutoLock lock(mLock);
    mWorkerBusy = false;
    FailLocked("input interop");
    return false;
  }

  RefPtr<NvidiaVfxSession> self = this;
  if (!worker || NS_FAILED(worker->Dispatch(
      NS_NewRunnableFunction("WorkerProcessFrame",
                             [self]() { self->WorkerProcessFrame(); }),
      NS_DISPATCH_NORMAL))) {
    MonitorAutoLock lock(mLock);
    mWorkerBusy = false;
    return false;
  }
  return true;
}

bool NvidiaVfxSession::PeekReady(SuperResolutionFrameToken* aToken) {
  MonitorAutoLock lock(mLock);
  if (!mHasReady) {
    return false;
  }
  if (aToken) {
    *aToken = mReadyToken;
  }
  return true;
}

bool NvidiaVfxSession::IsReadyComplete() {
  CuContext context = nullptr;
  void* event = nullptr;
  {
    MonitorAutoLock lock(mLock);
    if (!mHasReady || !mReadyEvent || !mCudaCtx) {
      return false;
    }
    context = mCudaCtx;
    event = mReadyEvent;
  }
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  if (loader.CuCtxPushCurrent(context) != 0) {
    return false;
  }
  const bool complete = loader.CuEventQuery(event) == 0;
  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);
  return complete;
}

bool NvidiaVfxSession::TakeReady(SuperResolutionFrameToken* aToken) {
  MonitorAutoLock lock(mLock);
  if (!mHasReady) {
    return false;
  }
  if (aToken) {
    *aToken = mReadyToken;
  }
  mHasReady = false;
  mReadyToken = SuperResolutionFrameToken{};
  return true;
}

bool NvidiaVfxSession::DownloadSlot(size_t aSlot, unsigned int aSlotTex,
                                     int aSlotW, int aSlotH) {
  {
    MonitorAutoLock lock(mLock);
    if (!mHasReady || aSlotW != mOutW || aSlotH != mOutH) {
      return false;
    }
  }
  return CopyOutputToSlot(aSlot, aSlotTex, aSlotW, aSlotH);
}

bool NvidiaVfxSession::UnregisterTexture(unsigned int aTex) {
  if (aTex == 0) {
    return true;
  }
  MutexAutoLock interopLock(mInteropLock);
  bool ok = true;
  if (mStagingReg.glTexture == aTex) {
    ok = ReleaseRegistration(mStagingReg) && ok;
  }
  for (auto& slot : mSlotRegs) {
    if (slot.glTexture == aTex) {
      ok = ReleaseRegistration(slot) && ok;
    }
  }
  if (!ok) {
    MonitorAutoLock lock(mLock);
    FailLocked("unregister interop");
  }
  return ok;
}

bool NvidiaVfxSession::ReleaseRegistration(GlRegistration& aReg) {
  if (!aReg.resource) {
    aReg = GlRegistration{};
    return true;
  }
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  CuContext context = nullptr;
  CuStream stream = nullptr;
  {
    MonitorAutoLock lock(mLock);
    context = mCudaCtx;
    stream = mCudaStream;
  }
  if (!context || loader.CuCtxPushCurrent(context) != 0) {
    return false;
  }
  bool ok = true;
  if (aReg.mapped) {
    ok = UnmapResource(loader, aReg.resource, stream);
  }
  if (ok) {
    ok = UnregisterGlTexture(loader, aReg.resource);
  }
  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);
  if (!ok) {
    return false;
  }
  aReg = GlRegistration{};
  return true;
}

bool NvidiaVfxSession::EnsureRegistration(GlRegistration& aReg,
                                           unsigned int aTex, int aW, int aH) {
  if (aReg.resource && aReg.glTexture == aTex && aReg.width == aW &&
      aReg.height == aH) {
    return true;
  }
  if (!ReleaseRegistration(aReg)) {
    return false;
  }
  CuContext context = nullptr;
  {
    MonitorAutoLock lock(mLock);
    context = mCudaCtx;
  }
  if (!context) {
    return false;
  }
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  if (loader.CuCtxPushCurrent(context) != 0) {
    return false;
  }
  CuGraphicsResource res = nullptr;
  const bool ok = RegisterGlTexture(loader, aTex, &res);
  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);
  if (!ok || !res) {
    return false;
  }
  aReg.glTexture = aTex;
  aReg.resource = res;
  aReg.width = aW;
  aReg.height = aH;
  aReg.mapped = false;
  return true;
}

void NvidiaVfxSession::UnregisterAllGl() {
  MutexAutoLock interopLock(mInteropLock);
  bool ok = ReleaseRegistration(mStagingReg);
  for (auto& slot : mSlotRegs) {
    ok = ReleaseRegistration(slot) && ok;
  }
  if (!ok) {
    MonitorAutoLock lock(mLock);
    FailLocked("unregister interop");
  }
}

void NvidiaVfxSession::WorkerProcessFrame() {
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  SuperResolutionQuality requestedQuality = kDefaultQuality;
  {
    MonitorAutoLock lock(mLock);
    if (mState != SuperResolutionSessionState::Ready || !mEffectReady ||
        !mCudaCtx || !mEffect) {
      if (mWorkerBusy) {
        mWorkerBusy = false;
      }
      return;
    }
    requestedQuality = mRequestedQuality;
  }

  if (loader.CuCtxPushCurrent(mCudaCtx) != 0) {
    MonitorAutoLock lock(mLock);
    FailLocked("worker context");
    return;
  }

  bool ok = false;
  do {
    if (requestedQuality != mAppliedQuality &&
        loader.SetU32(mEffect, kQualityLevelParam,
                      SuperResolutionQualityToNvVfx(requestedQuality)) != 0) {
      break;
    }
    mAppliedQuality = requestedQuality;

    MarkToken(kMarkerVfxStart, mWorkingToken);
    const int runRc = loader.RunEffect(mEffect, 0);
    MarkToken(kMarkerVfxEnd, mWorkingToken);
    if (runRc != 0) {
      break;
    }

    if (loader.CuEventRecord(mReadyEvent, mCudaStream) != 0) {
      break;
    }

    if (loader.HasStreamHostCallback()) {
      auto* signal = new CompletionSignal();
      signal->token = mWorkingToken;
      if (loader.CuLaunchHostFunc(mCudaStream, OnStreamComplete, signal) != 0) {
        delete signal;
      }
    }
    ok = true;
  } while (false);

  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);

  MonitorAutoLock lock(mLock);
  if (!ok) {
    mWorkerBusy = false;
    FailLocked("worker frame");
  } else {
    mReadyToken = mWorkingToken;
    mHasReady = true;
    mWorkerBusy = false;
  }
}

bool NvidiaVfxSession::MapAndCopyToInput(unsigned int aTex, int aW, int aH) {
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  CuContext ctx = nullptr;
  CuStream stream = nullptr;
  CuDevicePtr stagingIn = 0;
  size_t inputPitch = 0;
  {
    MonitorAutoLock lock(mLock);
    if (mState != SuperResolutionSessionState::Ready || !mCudaCtx ||
        !mCudaStream || !mEffectReady || aW != mVideoW || aH != mVideoH) {
      return false;
    }
    ctx = mCudaCtx;
    stream = mCudaStream;
    stagingIn = reinterpret_cast<CuDevicePtr>(mInImage.pixels);
    inputPitch = static_cast<size_t>(mInImage.pitch);
  }
  if (!stagingIn || inputPitch < static_cast<size_t>(aW * 4)) {
    return false;
  }

  MutexAutoLock interopLock(mInteropLock);
  if (!EnsureRegistration(mStagingReg, aTex, aW, aH)) {
    return false;
  }
  const CuGraphicsResource resource = mStagingReg.resource;

  if (loader.CuCtxPushCurrent(ctx) != 0) {
    return false;
  }

  bool ok = false;
  do {
    if (!MapResource(loader, resource, stream)) {
      break;
    }
    mStagingReg.mapped = true;
    void* mappedArray = nullptr;
    if (loader.GraphicsSubResourceGetMappedArray(&mappedArray, resource, 0, 0) != 0 ||
        !mappedArray) {
      mStagingReg.mapped = !UnmapResource(loader, resource, stream);
      break;
    }
    const size_t widthBytes = static_cast<size_t>(aW) * 4;
    ok = CopyArrayToImage(loader, stagingIn, inputPitch, mappedArray,
                          widthBytes, static_cast<size_t>(aH), stream);
    mStagingReg.mapped = !UnmapResource(loader, resource, stream);
  } while (false);

  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);
  if (!ok) {
    MonitorAutoLock lock(mLock);
    FailLocked("input interop");
  }
  return ok;
}

bool NvidiaVfxSession::CopyOutputToSlot(size_t aSlot, unsigned int aTex,
                                         int aW, int aH) {
  if (aSlot >= std::size(mSlotRegs) || aTex == 0 || aW <= 0 || aH <= 0) {
    return false;
  }

  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  CuContext ctx = nullptr;
  CuStream stream = nullptr;
  CuDevicePtr vfxOut = 0;
  size_t outputPitch = 0;
  {
    MonitorAutoLock lock(mLock);
    if (mState != SuperResolutionSessionState::Ready || !mCudaCtx ||
        !mCudaStream || !mEffectReady || aW != mOutW || aH != mOutH) {
      return false;
    }
    ctx = mCudaCtx;
    stream = mCudaStream;
    vfxOut = reinterpret_cast<CuDevicePtr>(mOutImage.pixels);
    outputPitch = static_cast<size_t>(mOutImage.pitch);
  }
  if (!vfxOut || outputPitch < static_cast<size_t>(aW * 4)) {
    return false;
  }

  MutexAutoLock interopLock(mInteropLock);
  if (!EnsureRegistration(mSlotRegs[aSlot], aTex, aW, aH)) {
    return false;
  }
  const CuGraphicsResource resource = mSlotRegs[aSlot].resource;

  if (loader.CuCtxPushCurrent(ctx) != 0) {
    return false;
  }

  bool ok = false;
  do {
    if (!MapResource(loader, resource, stream)) {
      break;
    }
    mSlotRegs[aSlot].mapped = true;
    void* mappedArray = nullptr;
    if (loader.GraphicsSubResourceGetMappedArray(&mappedArray, resource, 0, 0) != 0 ||
        !mappedArray) {
      mSlotRegs[aSlot].mapped = !UnmapResource(loader, resource, stream);
      break;
    }
    const size_t widthBytes = static_cast<size_t>(aW) * 4;
    ok = CopyImageToArray(loader, mappedArray, vfxOut, outputPitch,
                          widthBytes, static_cast<size_t>(aH), stream);
    mSlotRegs[aSlot].mapped = !UnmapResource(loader, resource, stream);
  } while (false);

  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);
  if (!ok) {
    MonitorAutoLock lock(mLock);
    FailLocked("output interop");
  }
  return ok;
}

bool NvidiaVfxSession::InitCudaOnWorker(const WorkerBinding& aBinding) {
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  if (!loader.EnsureLoaded()) {
    return false;
  }
  if (loader.CuInit(0) != 0) {
    return false;
  }

  CuContext ctx = nullptr;
  if (loader.CuCtxCreate(&ctx, 0, aBinding.glDevice) != 0 || !ctx) {
    return false;
  }

  CuStream stream = nullptr;
  if (loader.CuStreamCreate(&stream, kCuStreamNonBlocking) != 0 || !stream) {
    loader.CuCtxDestroy(ctx);
    return false;
  }

  void* readyEvent = nullptr;
  if (loader.CuEventCreate(&readyEvent, 0) != 0 || !readyEvent) {
    loader.CuStreamDestroy(stream);
    loader.CuCtxDestroy(ctx);
    return false;
  }

  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);

  MonitorAutoLock lock(mLock);
  mCudaCtx = ctx;
  mCudaStream = stream;
  mReadyEvent = readyEvent;
  return true;
}

bool NvidiaVfxSession::InitEffectOnWorker(const WorkerBinding& aBinding) {
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  if (!mCudaCtx || loader.CuCtxPushCurrent(mCudaCtx) != 0) {
    return false;
  }

  bool ok = false;
  do {
    if (loader.SetS32(nullptr, kGpuParam, aBinding.ordinal) != 0) {
      break;
    }
    int vfxOrdinal = -1;
    if (loader.GetS32(nullptr, kGpuParam, &vfxOrdinal) != 0 ||
        vfxOrdinal != aBinding.ordinal) {
      break;
    }
    if (loader.CreateEffect(kVideoSuperResEffect, &mEffect) != 0 || !mEffect) {
      break;
    }
    if (loader.SetU32(mEffect, kQualityLevelParam,
                      SuperResolutionQualityToNvVfx(aBinding.quality)) != 0) {
      break;
    }
    mAppliedQuality = aBinding.quality;

    if (loader.ImageAlloc(&mInImage, (unsigned)aBinding.videoW,
                          (unsigned)aBinding.videoH, kNvFormatRGBA,
                          kNvTypeU8, kNvChunky, kNvGpuMem, 32) != 0) {
      break;
    }
    if (loader.ImageAlloc(&mOutImage, (unsigned)aBinding.outW,
                          (unsigned)aBinding.outH, kNvFormatRGBA,
                          kNvTypeU8, kNvChunky, kNvGpuMem, 32) != 0) {
      break;
    }
    if (mInImage.pitch < aBinding.videoW * 4 ||
        mOutImage.pitch < aBinding.outW * 4) {
      break;
    }
    if (loader.SetImage(mEffect, kSrcImageParam, &mInImage) != 0) {
      break;
    }
    if (loader.SetImage(mEffect, kDstImageParam, &mOutImage) != 0) {
      break;
    }
    if (loader.SetCudaStream(mEffect, kCudaStreamParam, mCudaStream) != 0) {
      break;
    }
    if (loader.LoadEffect(mEffect) != 0) {
      break;
    }
    bool warmed = true;
    for (int i = 0; i < 3; ++i) {
      if (loader.RunEffect(mEffect, 0) != 0) {
        warmed = false;
        break;
      }
    }
    if (!warmed || loader.CuStreamSynchronize(mCudaStream) != 0) {
      break;
    }
    ok = true;
  } while (false);

  CuContext popped = nullptr;
  loader.CuCtxPopCurrent(&popped);

  if (!ok) {
    DestroyEffectOnWorker();
    return false;
  }

  MonitorAutoLock lock(mLock);
  mEffectReady = true;
  return true;
}

bool NvidiaVfxSession::DestroyEffectOnWorker() {
  MonitorAutoLock lock(mLock);
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  bool ok = true;
  if (mCudaCtx && loader.CuCtxPushCurrent(mCudaCtx) == 0) {
    if (mInImage.pixels) {
      loader.ImageFree(&mInImage);
      mInImage = NvCVImage{};
    }
    if (mOutImage.pixels) {
      loader.ImageFree(&mOutImage);
      mOutImage = NvCVImage{};
    }
    if (mEffect) {
      loader.DestroyEffect(mEffect);
      mEffect = nullptr;
    }
    CuContext popped = nullptr;
    loader.CuCtxPopCurrent(&popped);
  } else if (mEffect || mInImage.pixels || mOutImage.pixels) {
    ok = false;
  }
  mEffectReady = false;
  mHasReady = false;
  mWorkerBusy = false;
  return ok;
}

bool NvidiaVfxSession::DestroyCudaOnWorker() {
  MonitorAutoLock lock(mLock);
  NvidiaVfxLoader& loader = NvidiaVfxLoader::GetInstance();
  if (mCudaCtx && loader.CuCtxPushCurrent(mCudaCtx) == 0) {
    if (mReadyEvent) {
      loader.CuEventDestroy(mReadyEvent);
      mReadyEvent = nullptr;
    }
    if (mCudaStream) {
      loader.CuStreamDestroy(mCudaStream);
      mCudaStream = nullptr;
    }
    CuContext popped = nullptr;
    loader.CuCtxPopCurrent(&popped);
    loader.CuCtxDestroy(mCudaCtx);
    mCudaCtx = nullptr;
  }
  return true;
}

void NvidiaVfxSession::WorkerInit() {
  WorkerBinding binding;
  {
    MonitorAutoLock lock(mLock);
    mRebindQueued = false;
    if (mState == SuperResolutionSessionState::Failed ||
        mState == SuperResolutionSessionState::ShuttingDown) {
      return;
    }
    binding = SnapshotBinding();
  }

  if (!InitCudaOnWorker(binding)) {
    MonitorAutoLock lock(mLock);
    mState = SuperResolutionSessionState::Failed;
    return;
  }
  if (!InitEffectOnWorker(binding)) {
    DestroyCudaOnWorker();
    MonitorAutoLock lock(mLock);
    mState = SuperResolutionSessionState::Failed;
    return;
  }

  MonitorAutoLock lock(mLock);
  if (mState == SuperResolutionSessionState::ShuttingDown ||
      mState == SuperResolutionSessionState::Failed ||
      !BindingIsCurrent(binding)) {
    return;
  }
  mState = SuperResolutionSessionState::Ready;
}

void NvidiaVfxSession::WorkerRebind() {
  WorkerBinding binding;
  {
    MonitorAutoLock lock(mLock);
    mRebindQueued = false;
    if (mState == SuperResolutionSessionState::ShuttingDown ||
        mState == SuperResolutionSessionState::Failed) {
      return;
    }
    binding = SnapshotBinding();
  }

  DestroyEffectOnWorker();
  DestroyCudaOnWorker();

  if (!InitCudaOnWorker(binding)) {
    MonitorAutoLock lock(mLock);
    mState = SuperResolutionSessionState::Failed;
    return;
  }
  if (!InitEffectOnWorker(binding)) {
    DestroyCudaOnWorker();
    MonitorAutoLock lock(mLock);
    mState = SuperResolutionSessionState::Failed;
    return;
  }

  MonitorAutoLock lock(mLock);
  if (mState == SuperResolutionSessionState::ShuttingDown ||
      mState == SuperResolutionSessionState::Failed ||
      !BindingIsCurrent(binding)) {
    return;
  }
  mState = SuperResolutionSessionState::Ready;
}

NvidiaVfxSession::WorkerBinding NvidiaVfxSession::SnapshotBinding() {
  WorkerBinding binding;
  binding.videoW = mVideoW;
  binding.videoH = mVideoH;
  binding.outW = mOutW;
  binding.outH = mOutH;
  binding.quality = mRequestedQuality;
  binding.glDevice = mGlCudaDevice;
  binding.ordinal = mCudaOrdinal;
  return binding;
}

bool NvidiaVfxSession::BindingIsCurrent(const WorkerBinding& aBinding) {
  return mVideoW == aBinding.videoW && mVideoH == aBinding.videoH &&
         mOutW == aBinding.outW && mOutH == aBinding.outH &&
         mGlCudaDevice == aBinding.glDevice && mCudaOrdinal == aBinding.ordinal;
}

void NvidiaVfxSession::WorkerShutdown() {
  CuContext context = nullptr;
  CuStream stream = nullptr;
  {
    MonitorAutoLock lock(mLock);
    context = mCudaCtx;
    stream = mCudaStream;
  }
  if (context && NvidiaVfxLoader::GetInstance().CuCtxPushCurrent(context) == 0) {
    NvidiaVfxLoader::GetInstance().CuStreamSynchronize(stream);
    CuContext popped = nullptr;
    NvidiaVfxLoader::GetInstance().CuCtxPopCurrent(&popped);
  }
  DestroyEffectOnWorker();
  DestroyCudaOnWorker();
  MonitorAutoLock lock(mLock);
  mStagingReg = GlRegistration{};
  for (auto& slot : mSlotRegs) {
    slot = GlRegistration{};
  }
  mState = SuperResolutionSessionState::Uninitialized;
}

void NvidiaVfxSession::Shutdown() {
  nsCOMPtr<nsIThread> worker;
  {
    MonitorAutoLock lock(mLock);
    mState = SuperResolutionSessionState::ShuttingDown;
    worker = std::move(mWorkerThread);
  }
  UnregisterAllGl();
  if (worker) {
    RefPtr<NvidiaVfxSession> self = this;
    if (NS_FAILED(worker->Dispatch(
        NS_NewRunnableFunction("WorkerShutdown",
                               [self]() { self->WorkerShutdown(); }),
        NS_DISPATCH_NORMAL))) {
      MonitorAutoLock lock(mLock);
      FailLocked("dispatch worker shutdown");
      return;
    }
    worker->Shutdown();
  } else {
    DestroyEffectOnWorker();
    DestroyCudaOnWorker();
    MonitorAutoLock lock(mLock);
    mState = SuperResolutionSessionState::Uninitialized;
  }
  MonitorAutoLock lock(mLock);
  mVideoW = mVideoH = mOutW = mOutH = 0;
  mHasReady = false;
  mWorkerBusy = false;
}

}  // namespace mozilla::zen
