/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_NvidiaVfxLoader_h
#define mozilla_zen_NvidiaVfxLoader_h

#include "VideoSuperResolutionTypes.h"

#include <cstddef>

#include "mozilla/Atomics.h"
#include "mozilla/Mutex.h"

namespace mozilla::zen {

using CuDevice = int;
using CuContext = void*;
using CuStream = void*;
using CuDevicePtr = unsigned long long;
using CuGraphicsResource = void*;

class NvidiaVfxLoader {
 public:
  static NvidiaVfxLoader& GetInstance();

  bool EnsureLoaded();
  bool EnsureCudaLib();

  bool IsLoaded() const { return mLoaded; }
  bool IsCudaLibOk() const { return mCudaLibOk; }

  int CreateEffect(const char* aSelector, void** aHandle);
  void DestroyEffect(void* aHandle);
  int SetS32(void* aHandle, const char* aParam, int aValue);
  int GetS32(void* aHandle, const char* aParam, int* aValue);
  int SetU32(void* aHandle, const char* aParam, unsigned int aValue);
  int SetImage(void* aHandle, const char* aParam, NvCVImage* aImage);
  int SetCudaStream(void* aHandle, const char* aParam, CuStream aStream);
  int LoadEffect(void* aHandle);
  int RunEffect(void* aHandle, int aAsync);
  int ImageAlloc(NvCVImage* aImage, unsigned int aW, unsigned int aH,
                 int aFormat, int aType, int aLayout, unsigned int aMemSpace,
                 unsigned int aAlignment);
  int ImageFree(NvCVImage* aImage);

  int CuInit(unsigned int aFlags);
  int CuDeviceGetCount(int* aCount);
  int CuDeviceGet(CuDevice* aDevice, int aOrdinal);
  int CuDeviceGetAttribute(int* aValue, int aAttrib, CuDevice aDevice);
  int CuDeviceGetName(char* aName, int aLen, CuDevice aDevice);
  int CuDeviceGetUuid(CudaDeviceUuid* aUuid, CuDevice aDevice);
  int CuGLGetDevices(unsigned int* aCount, CuDevice* aDevices,
                     unsigned int aCapacity, unsigned int aDeviceList);
  int CuCtxCreate(CuContext* aCtx, unsigned int aFlags, CuDevice aDevice);
  int CuCtxDestroy(CuContext aCtx);
  int CuCtxPushCurrent(CuContext aCtx);
  int CuCtxPopCurrent(CuContext* aCtx);
  int CuStreamCreate(CuStream* aStream, unsigned int aFlags);
  int CuStreamDestroy(CuStream aStream);
  int CuStreamSynchronize(CuStream aStream);

  struct Memcpy2DParams {
    size_t srcXInBytes = 0;
    size_t srcY = 0;
    int srcMemoryType = 0;
    const void* srcHost = nullptr;
    CuDevicePtr srcDevice = 0;
    void* srcArray = nullptr;
    size_t srcPitch = 0;
    size_t dstXInBytes = 0;
    size_t dstY = 0;
    int dstMemoryType = 0;
    void* dstHost = nullptr;
    CuDevicePtr dstDevice = 0;
    void* dstArray = nullptr;
    size_t dstPitch = 0;
    size_t widthInBytes = 0;
    size_t height = 0;
  };
  static_assert(sizeof(Memcpy2DParams) == 128,
                "Memcpy2DParams must match CUDA_MEMCPY2D (64-bit)");

  int CuMemcpy2DAsync(const Memcpy2DParams* aParams, CuStream aStream);
  int CuEventCreate(void** aEvent, unsigned int aFlags);
  int CuEventDestroy(void* aEvent);
  int CuEventRecord(void* aEvent, CuStream aStream);
  int CuEventQuery(void* aEvent);
  bool HasStreamHostCallback() const;
  int CuLaunchHostFunc(CuStream aStream, void (*aCallback)(void*),
                       void* aUserData);

  bool HasGlInterop() const;
  int GraphicsGLRegisterImage(CuGraphicsResource* aResource,
                              unsigned int aTexture, int aTarget,
                              unsigned int aFlags);
  int GraphicsUnregisterResource(CuGraphicsResource aResource);
  int GraphicsMapResources(unsigned int aCount,
                           CuGraphicsResource* aResources,
                           CuStream aStream);
  int GraphicsUnmapResources(unsigned int aCount,
                             CuGraphicsResource* aResources,
                             CuStream aStream);
  int GraphicsSubResourceGetMappedArray(void** aArray,
                                        CuGraphicsResource aResource,
                                        unsigned int aIndex,
                                        unsigned int aLevel);

 private:
  NvidiaVfxLoader() = default;
  ~NvidiaVfxLoader() = default;
  NvidiaVfxLoader(const NvidiaVfxLoader&) = delete;
  NvidiaVfxLoader& operator=(const NvidiaVfxLoader&) = delete;

  bool OpenLibraries();
  void* Resolve(const char* aSymbol);
  void CloseLibraries();
  void ClearFunctions();

  Mutex mLoadLock{"VfxLoader"};
  Atomic<bool> mLoaded{false};
  Atomic<bool> mCudaLibOk{false};
  void* mLibHandles[32] = {};
  size_t mLibCount = 0;

  void* mFnCreateEffect = nullptr;
  void* mFnDestroyEffect = nullptr;
  void* mFnSetS32 = nullptr;
  void* mFnGetS32 = nullptr;
  void* mFnSetU32 = nullptr;
  void* mFnSetImage = nullptr;
  void* mFnSetCudaStream = nullptr;
  void* mFnLoad = nullptr;
  void* mFnRun = nullptr;
  void* mFnImageAlloc = nullptr;
  void* mFnImageFree = nullptr;
  void* mFnCuInit = nullptr;
  void* mFnCuDeviceGetCount = nullptr;
  void* mFnCuDeviceGet = nullptr;
  void* mFnCuDeviceGetAttribute = nullptr;
  void* mFnCuDeviceGetName = nullptr;
  void* mFnCuDeviceGetUuid = nullptr;
  void* mFnCuGLGetDevices = nullptr;
  void* mFnCuCtxCreate = nullptr;
  void* mFnCuCtxDestroy = nullptr;
  void* mFnCuCtxPushCurrent = nullptr;
  void* mFnCuCtxPopCurrent = nullptr;
  void* mFnCuStreamCreate = nullptr;
  void* mFnCuStreamDestroy = nullptr;
  void* mFnCuStreamSynchronize = nullptr;
  void* mFnCuMemcpy2DAsync = nullptr;
  void* mFnCuEventCreate = nullptr;
  void* mFnCuEventDestroy = nullptr;
  void* mFnCuEventRecord = nullptr;
  void* mFnCuEventQuery = nullptr;
  void* mFnCuLaunchHostFunc = nullptr;
  void* mFnGraphicsGLRegisterImage = nullptr;
  void* mFnGraphicsUnregisterResource = nullptr;
  void* mFnGraphicsMapResources = nullptr;
  void* mFnGraphicsUnmapResources = nullptr;
  void* mFnGraphicsSubResourceGetMappedArray = nullptr;
};

}  // namespace mozilla::zen

#endif  // mozilla_zen_NvidiaVfxLoader_h
