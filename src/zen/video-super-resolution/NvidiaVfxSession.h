/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_NvidiaVfxSession_h
#define mozilla_zen_NvidiaVfxSession_h

#include "CudaGlInterop.h"
#include "NvidiaVfxLoader.h"
#include "VideoSuperResolutionTypes.h"

#include <cstddef>
#include <cstdint>

#include "mozilla/Monitor.h"
#include "mozilla/Mutex.h"
#include "nsCOMPtr.h"

class nsIThread;

namespace mozilla::zen {

class NvidiaVfxSession {
 public:
  NS_INLINE_DECL_THREADSAFE_REFCOUNTING(NvidiaVfxSession)

  NvidiaVfxSession();

  uint64_t EnsureWorker(int aVideoW, int aVideoH, int aOutW, int aOutH,
                        SuperResolutionQuality aQuality, CuDevice aGlCudaDevice,
                        int aCudaOrdinal);

  bool SubmitInput(const SuperResolutionFrameToken& aToken, unsigned int aStagingTex,
                   int aStagingW, int aStagingH);

  bool PeekReady(SuperResolutionFrameToken* aToken);
  bool IsReadyComplete();
  bool TakeReady(SuperResolutionFrameToken* aToken);

  bool DownloadSlot(size_t aSlot, unsigned int aSlotTex, int aSlotW, int aSlotH);
  bool UnregisterTexture(unsigned int aTex);

  SuperResolutionSessionState State() const;

  void Shutdown();

 private:
  virtual ~NvidiaVfxSession();

  struct GlRegistration {
    unsigned int glTexture = 0;
    CuGraphicsResource resource = nullptr;
    int width = 0;
    int height = 0;
    bool mapped = false;
  };

  struct WorkerBinding {
    int videoW = 0;
    int videoH = 0;
    int outW = 0;
    int outH = 0;
    SuperResolutionQuality quality = kDefaultQuality;
    CuDevice glDevice = -1;
    int ordinal = -1;
  };

  void WorkerInit();
  void WorkerRebind();
  void WorkerProcessFrame();
  void WorkerShutdown();

  bool InitCudaOnWorker(const WorkerBinding& aBinding);
  bool InitEffectOnWorker(const WorkerBinding& aBinding);
  bool DestroyEffectOnWorker();
  bool DestroyCudaOnWorker();

  bool MapAndCopyToInput(unsigned int aTex, int aW, int aH);
  bool CopyOutputToSlot(size_t aSlot, unsigned int aTex, int aW, int aH);
  void UnregisterAllGl();

  bool EnsureRegistration(GlRegistration& aReg, unsigned int aTex, int aW, int aH);
  bool ReleaseRegistration(GlRegistration& aReg);
  void FailLocked(const char* aWhere);

  WorkerBinding SnapshotBinding();
  bool BindingIsCurrent(const WorkerBinding& aBinding);

  mutable Monitor mLock{"NvidiaVfxSession"};
  Mutex mInteropLock{"NvidiaVfxSessionInterop"};
  SuperResolutionSessionState mState = SuperResolutionSessionState::Uninitialized;
  uint64_t mGeneration = 0;

  int mVideoW = 0;
  int mVideoH = 0;
  int mOutW = 0;
  int mOutH = 0;
  SuperResolutionQuality mRequestedQuality = kDefaultQuality;
  SuperResolutionQuality mAppliedQuality = kDefaultQuality;
  CuDevice mGlCudaDevice = -1;
  int mCudaOrdinal = -1;

  CuContext mCudaCtx = nullptr;
  CuStream mCudaStream = nullptr;
  void* mReadyEvent = nullptr;
  void* mEffect = nullptr;
  NvCVImage mInImage{};
  NvCVImage mOutImage{};

  GlRegistration mStagingReg;
  GlRegistration mSlotRegs[4];

  bool mEffectReady = false;
  bool mWorkerBusy = false;
  bool mHasReady = false;
  bool mRebindQueued = false;
  SuperResolutionFrameToken mWorkingToken;
  SuperResolutionFrameToken mReadyToken;

  nsCOMPtr<nsIThread> mWorkerThread;

};

}  // namespace mozilla::zen

#endif  // mozilla_zen_NvidiaVfxSession_h
