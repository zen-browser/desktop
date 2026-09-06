/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "CudaGlInterop.h"

namespace mozilla::zen {

bool RegisterGlTexture(NvidiaVfxLoader& aLoader, unsigned int aTexture,
                       CuGraphicsResource* aOut) {
  if (!aLoader.HasGlInterop() || !aOut) {
    return false;
  }
  *aOut = nullptr;
  int rc = aLoader.GraphicsGLRegisterImage(
      aOut, aTexture, kGlTexture2D, kCuGraphicsRegisterNone);
  return rc == 0 && *aOut != nullptr;
}

bool UnregisterGlTexture(NvidiaVfxLoader& aLoader, CuGraphicsResource aRes) {
  if (!aLoader.HasGlInterop() || !aRes) {
    return false;
  }
  return aLoader.GraphicsUnregisterResource(aRes) == 0;
}

bool MapResource(NvidiaVfxLoader& aLoader, CuGraphicsResource aRes,
                 CuStream aStream) {
  if (!aLoader.HasGlInterop() || !aRes) {
    return false;
  }
  CuGraphicsResource resList[1] = {aRes};
  return aLoader.GraphicsMapResources(1, resList, aStream) == 0;
}

bool UnmapResource(NvidiaVfxLoader& aLoader, CuGraphicsResource aRes,
                   CuStream aStream) {
  if (!aLoader.HasGlInterop() || !aRes) {
    return false;
  }
  CuGraphicsResource resList[1] = {aRes};
  return aLoader.GraphicsUnmapResources(1, resList, aStream) == 0;
}

bool CopyImage(NvidiaVfxLoader& aLoader, CuDevicePtr aDst, size_t aDstPitch,
               CuDevicePtr aSrc, size_t aSrcPitch, size_t aWidthBytes,
               size_t aHeight, CuStream aStream) {
  if (!aDst || !aSrc || aWidthBytes == 0 || aHeight == 0) {
    return false;
  }
  NvidiaVfxLoader::Memcpy2DParams p;
  p.srcMemoryType = 2;
  p.srcDevice = aSrc;
  p.srcPitch = aSrcPitch;
  p.dstMemoryType = 2;
  p.dstDevice = aDst;
  p.dstPitch = aDstPitch;
  p.widthInBytes = aWidthBytes;
  p.height = aHeight;
  return aLoader.CuMemcpy2DAsync(&p, aStream) == 0;
}

bool CopyArrayToImage(NvidiaVfxLoader& aLoader, CuDevicePtr aDst,
                      size_t aDstPitch, void* aSrcArray, size_t aWidthBytes,
                      size_t aHeight, CuStream aStream) {
  if (!aDst || !aSrcArray || aWidthBytes == 0 || aHeight == 0) {
    return false;
  }
  NvidiaVfxLoader::Memcpy2DParams p;
  p.srcMemoryType = 3;
  p.srcArray = aSrcArray;
  p.dstMemoryType = 2;
  p.dstDevice = aDst;
  p.dstPitch = aDstPitch;
  p.widthInBytes = aWidthBytes;
  p.height = aHeight;
  return aLoader.CuMemcpy2DAsync(&p, aStream) == 0;
}

bool CopyImageToArray(NvidiaVfxLoader& aLoader, void* aDstArray,
                      CuDevicePtr aSrc, size_t aSrcPitch, size_t aWidthBytes,
                      size_t aHeight, CuStream aStream) {
  if (!aDstArray || !aSrc || aWidthBytes == 0 || aHeight == 0) {
    return false;
  }
  NvidiaVfxLoader::Memcpy2DParams p;
  p.srcMemoryType = 2;
  p.srcDevice = aSrc;
  p.srcPitch = aSrcPitch;
  p.dstMemoryType = 3;
  p.dstArray = aDstArray;
  p.widthInBytes = aWidthBytes;
  p.height = aHeight;
  return aLoader.CuMemcpy2DAsync(&p, aStream) == 0;
}

}  // namespace mozilla::zen
