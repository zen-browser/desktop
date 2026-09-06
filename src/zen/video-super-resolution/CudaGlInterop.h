/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_zen_CudaGlInterop_h
#define mozilla_zen_CudaGlInterop_h

#include <cstddef>

#include "NvidiaVfxLoader.h"
#include "VideoSuperResolutionTypes.h"

namespace mozilla::zen {

inline constexpr int kGlTexture2D = 0x0DE1;
inline constexpr unsigned int kCuGraphicsRegisterNone = 0;
inline constexpr unsigned int kCuStreamNonBlocking = 1;

bool RegisterGlTexture(NvidiaVfxLoader& aLoader, unsigned int aTexture,
                       CuGraphicsResource* aOut);

bool UnregisterGlTexture(NvidiaVfxLoader& aLoader, CuGraphicsResource aRes);

bool MapResource(NvidiaVfxLoader& aLoader, CuGraphicsResource aRes,
                 CuStream aStream);

bool UnmapResource(NvidiaVfxLoader& aLoader, CuGraphicsResource aRes,
                   CuStream aStream);

bool CopyImage(NvidiaVfxLoader& aLoader, CuDevicePtr aDst, size_t aDstPitch,
               CuDevicePtr aSrc, size_t aSrcPitch, size_t aWidthBytes,
               size_t aHeight, CuStream aStream);

bool CopyArrayToImage(NvidiaVfxLoader& aLoader, CuDevicePtr aDst,
                      size_t aDstPitch, void* aSrcArray, size_t aWidthBytes,
                      size_t aHeight, CuStream aStream);

bool CopyImageToArray(NvidiaVfxLoader& aLoader, void* aDstArray,
                      CuDevicePtr aSrc, size_t aSrcPitch, size_t aWidthBytes,
                      size_t aHeight, CuStream aStream);

}  // namespace mozilla::zen

#endif  // mozilla_zen_CudaGlInterop_h
