/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "NvidiaVfxLoader.h"

#include <dlfcn.h>
#include <iterator>

#include "mozilla/Logging.h"

namespace mozilla::zen {

static LazyLogModule sVideoSuperResolutionLog("VideoSuperResolution");

NvidiaVfxLoader& NvidiaVfxLoader::GetInstance() {
  static NvidiaVfxLoader sInstance;
  return sInstance;
}

static const char* const kRequiredLibraries[] = {
    "libnppc.so.12",
    "libnppial.so.12",
    "libnppig.so.12",
    "libnppicc.so.12",
    "libnppidei.so.12",
    "libnppif.so.12",
    "libnppim.so.12",
    "libnppist.so.12",
    "libnppitc.so.12",
    "libcudnn.so.9",
    "libnvinfer.so.10",
    "libnvinfer_plugin.so.10",
    "libnvonnxparser.so.10",
    "libNVCVImage.so",
    "libnvngxruntime.so",
    "libVideoFXLocal.so",
    "libVideoFX.so",
    "libnvVFXVideoSuperRes.so",
    "libnvidia-ngx-vsr.so.1.8.2",
};

bool NvidiaVfxLoader::OpenLibraries() {
  for (const char* name : kRequiredLibraries) {
    if (mLibCount == std::size(mLibHandles)) {
      return false;
    }
    void* handle = dlopen(name, RTLD_NOW | RTLD_GLOBAL);
    if (!handle) {
      MOZ_LOG(sVideoSuperResolutionLog, LogLevel::Warning,
              ("VSR unavailable: NVIDIA VFX runtime missing (%s)", name));
      return false;
    }
    mLibHandles[mLibCount++] = handle;
  }
  return true;
}

void* NvidiaVfxLoader::Resolve(const char* aSymbol) {
  for (size_t i = 0; i < mLibCount; i++) {
    void* sym = dlsym(mLibHandles[i], aSymbol);
    if (sym) {
      return sym;
    }
  }
  return nullptr;
}

void NvidiaVfxLoader::CloseLibraries() {
  for (size_t i = 0; i < mLibCount; i++) {
    if (mLibHandles[i]) {
      dlclose(mLibHandles[i]);
      mLibHandles[i] = nullptr;
    }
  }
  mLibCount = 0;
}

void NvidiaVfxLoader::ClearFunctions() {
  mFnCreateEffect = nullptr;
  mFnDestroyEffect = nullptr;
  mFnSetS32 = nullptr;
  mFnGetS32 = nullptr;
  mFnSetU32 = nullptr;
  mFnSetImage = nullptr;
  mFnSetCudaStream = nullptr;
  mFnLoad = nullptr;
  mFnRun = nullptr;
  mFnImageAlloc = nullptr;
  mFnImageFree = nullptr;
  mFnCuInit = nullptr;
  mFnCuDeviceGetCount = nullptr;
  mFnCuDeviceGet = nullptr;
  mFnCuDeviceGetAttribute = nullptr;
  mFnCuDeviceGetName = nullptr;
  mFnCuDeviceGetUuid = nullptr;
  mFnCuGLGetDevices = nullptr;
  mFnCuCtxCreate = nullptr;
  mFnCuCtxDestroy = nullptr;
  mFnCuCtxPushCurrent = nullptr;
  mFnCuCtxPopCurrent = nullptr;
  mFnCuStreamCreate = nullptr;
  mFnCuStreamDestroy = nullptr;
  mFnCuStreamSynchronize = nullptr;
  mFnCuMemcpy2DAsync = nullptr;
  mFnCuEventCreate = nullptr;
  mFnCuEventDestroy = nullptr;
  mFnCuEventRecord = nullptr;
  mFnCuEventQuery = nullptr;
  mFnCuLaunchHostFunc = nullptr;
  mFnGraphicsGLRegisterImage = nullptr;
  mFnGraphicsUnregisterResource = nullptr;
  mFnGraphicsMapResources = nullptr;
  mFnGraphicsUnmapResources = nullptr;
  mFnGraphicsSubResourceGetMappedArray = nullptr;
}

#define RESOLVE_REQUIRED(field, name) \
  mFn##field = Resolve(name);         \
  if (!mFn##field) {                  \
    goto failed;                      \
  }

bool NvidiaVfxLoader::EnsureCudaLib() {
  if (mCudaLibOk) {
    return true;
  }
  MutexAutoLock lock(mLoadLock);
  if (mCudaLibOk) {
    return true;
  }
  void* cuda = dlopen("libcuda.so.1", RTLD_NOW | RTLD_LOCAL);
  if (!cuda) {
    return false;
  }
  if (mLibCount == std::size(mLibHandles)) {
    dlclose(cuda);
    return false;
  }
  mLibHandles[mLibCount++] = cuda;
  mFnCuInit = Resolve("cuInit");
  mFnCuGLGetDevices = Resolve("cuGLGetDevices");
  mFnCuDeviceGetCount = Resolve("cuDeviceGetCount");
  mFnCuDeviceGet = Resolve("cuDeviceGet");
  mFnCuDeviceGetName = Resolve("cuDeviceGetName");
  mFnCuDeviceGetAttribute = Resolve("cuDeviceGetAttribute");
  mFnCuDeviceGetUuid = Resolve("cuDeviceGetUuid");
  mFnCuCtxCreate = Resolve("cuCtxCreate_v2");
  mFnCuCtxDestroy = Resolve("cuCtxDestroy_v2");
  mFnCuCtxPushCurrent = Resolve("cuCtxPushCurrent_v2");
  mFnCuCtxPopCurrent = Resolve("cuCtxPopCurrent_v2");
  mFnCuStreamCreate = Resolve("cuStreamCreate");
  mFnCuStreamDestroy = Resolve("cuStreamDestroy_v2");
  mFnCuStreamSynchronize = Resolve("cuStreamSynchronize");
  mFnCuMemcpy2DAsync = Resolve("cuMemcpy2DAsync_v2");
  mFnCuEventCreate = Resolve("cuEventCreate");
  mFnCuEventDestroy = Resolve("cuEventDestroy_v2");
  mFnCuEventRecord = Resolve("cuEventRecord");
  mFnCuEventQuery = Resolve("cuEventQuery");
  mFnCuLaunchHostFunc = Resolve("cuLaunchHostFunc");
  mFnGraphicsGLRegisterImage = Resolve("cuGraphicsGLRegisterImage");
  mFnGraphicsUnregisterResource = Resolve("cuGraphicsUnregisterResource");
  mFnGraphicsMapResources = Resolve("cuGraphicsMapResources");
  mFnGraphicsUnmapResources = Resolve("cuGraphicsUnmapResources");
  mFnGraphicsSubResourceGetMappedArray =
      Resolve("cuGraphicsSubResourceGetMappedArray");
  if (!mFnCuInit || !mFnCuDeviceGetCount || !mFnCuDeviceGet ||
      !mFnCuDeviceGetAttribute || !mFnCuDeviceGetName || !mFnCuDeviceGetUuid ||
      !mFnCuGLGetDevices || !mFnCuCtxCreate || !mFnCuCtxDestroy ||
      !mFnCuCtxPushCurrent || !mFnCuCtxPopCurrent || !mFnCuStreamCreate ||
      !mFnCuStreamDestroy || !mFnCuStreamSynchronize || !mFnCuMemcpy2DAsync ||
      !mFnCuEventCreate || !mFnCuEventDestroy || !mFnCuEventRecord ||
      !mFnCuEventQuery || !mFnGraphicsGLRegisterImage ||
      !mFnGraphicsUnregisterResource || !mFnGraphicsMapResources ||
      !mFnGraphicsUnmapResources || !mFnGraphicsSubResourceGetMappedArray) {
    CloseLibraries();
    ClearFunctions();
    return false;
  }
  mCudaLibOk = true;
  return true;
}

bool NvidiaVfxLoader::EnsureLoaded() {
  if (mLoaded) {
    return true;
  }
  if (!EnsureCudaLib()) {
    return false;
  }
  MutexAutoLock lock(mLoadLock);
  if (mLoaded) {
    return true;
  }
  if (!OpenLibraries()) {
    CloseLibraries();
    ClearFunctions();
    mCudaLibOk = false;
    return false;
  }
  RESOLVE_REQUIRED(CreateEffect, "NvVFX_CreateEffect");
  RESOLVE_REQUIRED(DestroyEffect, "NvVFX_DestroyEffect");
  RESOLVE_REQUIRED(SetS32, "NvVFX_SetS32");
  RESOLVE_REQUIRED(GetS32, "NvVFX_GetS32");
  RESOLVE_REQUIRED(SetU32, "NvVFX_SetU32");
  RESOLVE_REQUIRED(SetImage, "NvVFX_SetImage");
  RESOLVE_REQUIRED(SetCudaStream, "NvVFX_SetCudaStream");
  RESOLVE_REQUIRED(Load, "NvVFX_Load");
  RESOLVE_REQUIRED(Run, "NvVFX_Run");
  RESOLVE_REQUIRED(ImageAlloc, "NvCVImage_Alloc");
  RESOLVE_REQUIRED(ImageFree, "NvCVImage_Dealloc");
  mLoaded = true;
  return true;

failed:
  CloseLibraries();
  ClearFunctions();
  mLoaded = false;
  mCudaLibOk = false;
  return false;
}

#undef RESOLVE_REQUIRED

int NvidiaVfxLoader::CreateEffect(const char* aSelector, void** aHandle) {
  if (!mFnCreateEffect) return -1;
  return reinterpret_cast<int (*)(const char*, void**)>(mFnCreateEffect)(
      aSelector, aHandle);
}

void NvidiaVfxLoader::DestroyEffect(void* aHandle) {
  if (!mFnDestroyEffect || !aHandle) return;
  reinterpret_cast<void (*)(void*)>(mFnDestroyEffect)(aHandle);
}

int NvidiaVfxLoader::SetS32(void* aHandle, const char* aParam, int aValue) {
  if (!mFnSetS32) return -1;
  return reinterpret_cast<int (*)(void*, const char*, int)>(mFnSetS32)(
      aHandle, aParam, aValue);
}

int NvidiaVfxLoader::GetS32(void* aHandle, const char* aParam, int* aValue) {
  if (!mFnGetS32 || !aValue) return -1;
  return reinterpret_cast<int (*)(void*, const char*, int*)>(mFnGetS32)(
      aHandle, aParam, aValue);
}

int NvidiaVfxLoader::SetU32(void* aHandle, const char* aParam,
                            unsigned int aValue) {
  if (!mFnSetU32) return -1;
  return reinterpret_cast<int (*)(void*, const char*, unsigned int)>(
      mFnSetU32)(aHandle, aParam, aValue);
}

int NvidiaVfxLoader::SetImage(void* aHandle, const char* aParam,
                              NvCVImage* aImage) {
  if (!mFnSetImage) return -1;
  return reinterpret_cast<int (*)(void*, const char*, NvCVImage*)>(
      mFnSetImage)(aHandle, aParam, aImage);
}

int NvidiaVfxLoader::SetCudaStream(void* aHandle, const char* aParam,
                                   CuStream aStream) {
  if (!mFnSetCudaStream) return -1;
  return reinterpret_cast<int (*)(void*, const char*, CuStream)>(
      mFnSetCudaStream)(aHandle, aParam, aStream);
}

int NvidiaVfxLoader::LoadEffect(void* aHandle) {
  if (!mFnLoad) return -1;
  return reinterpret_cast<int (*)(void*)>(mFnLoad)(aHandle);
}

int NvidiaVfxLoader::RunEffect(void* aHandle, int aAsync) {
  if (!mFnRun) return -1;
  return reinterpret_cast<int (*)(void*, int)>(mFnRun)(aHandle, aAsync);
}

int NvidiaVfxLoader::ImageAlloc(NvCVImage* aImage, unsigned int aW,
                                unsigned int aH, int aFormat, int aType,
                                int aLayout, unsigned int aMemSpace,
                                unsigned int aAlignment) {
  if (!mFnImageAlloc) return -1;
  return reinterpret_cast<int (*)(NvCVImage*, unsigned int, unsigned int, int,
                                  int, int, unsigned int, unsigned int)>(
      mFnImageAlloc)(aImage, aW, aH, aFormat, aType, aLayout, aMemSpace,
                     aAlignment);
}

int NvidiaVfxLoader::ImageFree(NvCVImage* aImage) {
  if (!mFnImageFree) return -1;
  return reinterpret_cast<int (*)(NvCVImage*)>(mFnImageFree)(aImage);
}

int NvidiaVfxLoader::CuInit(unsigned int aFlags) {
  if (!mFnCuInit) return -1;
  return reinterpret_cast<int (*)(unsigned int)>(mFnCuInit)(aFlags);
}

int NvidiaVfxLoader::CuDeviceGetCount(int* aCount) {
  if (!mFnCuDeviceGetCount) return -1;
  return reinterpret_cast<int (*)(int*)>(mFnCuDeviceGetCount)(aCount);
}

int NvidiaVfxLoader::CuDeviceGet(CuDevice* aDevice, int aOrdinal) {
  if (!mFnCuDeviceGet) return -1;
  return reinterpret_cast<int (*)(CuDevice*, int)>(mFnCuDeviceGet)(
      aDevice, aOrdinal);
}

int NvidiaVfxLoader::CuDeviceGetAttribute(int* aValue, int aAttrib,
                                          CuDevice aDevice) {
  if (!mFnCuDeviceGetAttribute) return -1;
  return reinterpret_cast<int (*)(int*, int, CuDevice)>(
      mFnCuDeviceGetAttribute)(aValue, aAttrib, aDevice);
}

int NvidiaVfxLoader::CuDeviceGetName(char* aName, int aLen,
                                     CuDevice aDevice) {
  if (!mFnCuDeviceGetName) return -1;
  return reinterpret_cast<int (*)(char*, int, CuDevice)>(
      mFnCuDeviceGetName)(aName, aLen, aDevice);
}

int NvidiaVfxLoader::CuDeviceGetUuid(CudaDeviceUuid* aUuid,
                                     CuDevice aDevice) {
  if (!mFnCuDeviceGetUuid) return -1;
  return reinterpret_cast<int (*)(CudaDeviceUuid*, CuDevice)>(
      mFnCuDeviceGetUuid)(aUuid, aDevice);
}

int NvidiaVfxLoader::CuGLGetDevices(unsigned int* aCount,
                                    CuDevice* aDevices,
                                    unsigned int aCapacity,
                                    unsigned int aDeviceList) {
  if (!mFnCuGLGetDevices) return -1;
  return reinterpret_cast<int (*)(unsigned int*, CuDevice*, unsigned int,
                                  unsigned int)>(mFnCuGLGetDevices)(
      aCount, aDevices, aCapacity, aDeviceList);
}

int NvidiaVfxLoader::CuCtxCreate(CuContext* aCtx, unsigned int aFlags,
                                 CuDevice aDevice) {
  if (!mFnCuCtxCreate) return -1;
  return reinterpret_cast<int (*)(CuContext*, unsigned int, CuDevice)>(
      mFnCuCtxCreate)(aCtx, aFlags, aDevice);
}

int NvidiaVfxLoader::CuCtxDestroy(CuContext aCtx) {
  if (!mFnCuCtxDestroy) return -1;
  return reinterpret_cast<int (*)(CuContext)>(mFnCuCtxDestroy)(aCtx);
}

int NvidiaVfxLoader::CuCtxPushCurrent(CuContext aCtx) {
  if (!mFnCuCtxPushCurrent) return -1;
  return reinterpret_cast<int (*)(CuContext)>(mFnCuCtxPushCurrent)(aCtx);
}

int NvidiaVfxLoader::CuCtxPopCurrent(CuContext* aCtx) {
  if (!mFnCuCtxPopCurrent) return -1;
  return reinterpret_cast<int (*)(CuContext*)>(mFnCuCtxPopCurrent)(aCtx);
}

int NvidiaVfxLoader::CuStreamCreate(CuStream* aStream,
                                    unsigned int aFlags) {
  if (!mFnCuStreamCreate) return -1;
  return reinterpret_cast<int (*)(CuStream*, unsigned int)>(mFnCuStreamCreate)(
      aStream, aFlags);
}

int NvidiaVfxLoader::CuStreamDestroy(CuStream aStream) {
  if (!mFnCuStreamDestroy) return -1;
  return reinterpret_cast<int (*)(CuStream)>(mFnCuStreamDestroy)(aStream);
}

int NvidiaVfxLoader::CuStreamSynchronize(CuStream aStream) {
  if (!mFnCuStreamSynchronize) return -1;
  return reinterpret_cast<int (*)(CuStream)>(mFnCuStreamSynchronize)(aStream);
}

int NvidiaVfxLoader::CuMemcpy2DAsync(const Memcpy2DParams* aParams,
                                     CuStream aStream) {
  if (!mFnCuMemcpy2DAsync) return -1;
  return reinterpret_cast<int (*)(const Memcpy2DParams*, CuStream)>(
      mFnCuMemcpy2DAsync)(aParams, aStream);
}

int NvidiaVfxLoader::CuEventCreate(void** aEvent, unsigned int aFlags) {
  if (!mFnCuEventCreate) return -1;
  return reinterpret_cast<int (*)(void**, unsigned int)>(mFnCuEventCreate)(
      aEvent, aFlags);
}

int NvidiaVfxLoader::CuEventDestroy(void* aEvent) {
  if (!mFnCuEventDestroy) return -1;
  return reinterpret_cast<int (*)(void*)>(mFnCuEventDestroy)(aEvent);
}

int NvidiaVfxLoader::CuEventRecord(void* aEvent, CuStream aStream) {
  if (!mFnCuEventRecord) return -1;
  return reinterpret_cast<int (*)(void*, CuStream)>(mFnCuEventRecord)(
      aEvent, aStream);
}

int NvidiaVfxLoader::CuEventQuery(void* aEvent) {
  if (!mFnCuEventQuery) return -1;
  return reinterpret_cast<int (*)(void*)>(mFnCuEventQuery)(aEvent);
}

bool NvidiaVfxLoader::HasStreamHostCallback() const {
  return mFnCuLaunchHostFunc != nullptr;
}

int NvidiaVfxLoader::CuLaunchHostFunc(CuStream aStream,
                                      void (*aCallback)(void*),
                                      void* aUserData) {
  if (!mFnCuLaunchHostFunc) return -1;
  return reinterpret_cast<int (*)(CuStream, void (*)(void*), void*)>(
      mFnCuLaunchHostFunc)(aStream, aCallback, aUserData);
}

bool NvidiaVfxLoader::HasGlInterop() const {
  return mFnGraphicsGLRegisterImage && mFnGraphicsUnregisterResource &&
         mFnGraphicsMapResources && mFnGraphicsUnmapResources &&
         mFnGraphicsSubResourceGetMappedArray;
}

int NvidiaVfxLoader::GraphicsGLRegisterImage(
    CuGraphicsResource* aResource, unsigned int aTexture, int aTarget,
    unsigned int aFlags) {
  if (!mFnGraphicsGLRegisterImage) return -1;
  return reinterpret_cast<int (*)(CuGraphicsResource*, unsigned int, int,
                                  unsigned int)>(mFnGraphicsGLRegisterImage)(
      aResource, aTexture, aTarget, aFlags);
}

int NvidiaVfxLoader::GraphicsUnregisterResource(
    CuGraphicsResource aResource) {
  if (!mFnGraphicsUnregisterResource) return -1;
  return reinterpret_cast<int (*)(CuGraphicsResource)>(
      mFnGraphicsUnregisterResource)(aResource);
}

int NvidiaVfxLoader::GraphicsMapResources(
    unsigned int aCount, CuGraphicsResource* aResources,
    CuStream aStream) {
  if (!mFnGraphicsMapResources) return -1;
  return reinterpret_cast<int (*)(unsigned int, CuGraphicsResource*, CuStream)>(
      mFnGraphicsMapResources)(aCount, aResources, aStream);
}

int NvidiaVfxLoader::GraphicsUnmapResources(
    unsigned int aCount, CuGraphicsResource* aResources,
    CuStream aStream) {
  if (!mFnGraphicsUnmapResources) return -1;
  return reinterpret_cast<int (*)(unsigned int, CuGraphicsResource*, CuStream)>(
      mFnGraphicsUnmapResources)(aCount, aResources, aStream);
}

int NvidiaVfxLoader::GraphicsSubResourceGetMappedArray(
    void** aArray, CuGraphicsResource aResource, unsigned int aIndex,
    unsigned int aLevel) {
  if (!mFnGraphicsSubResourceGetMappedArray) return -1;
  return reinterpret_cast<int (*)(void**, CuGraphicsResource, unsigned int,
                                  unsigned int)>(
      mFnGraphicsSubResourceGetMappedArray)(aArray, aResource, aIndex, aLevel);
}

}  // namespace mozilla::zen
