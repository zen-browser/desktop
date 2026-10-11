/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenLibraryFiles.h"

#include <algorithm>
#include <utility>

#include "nsCOMPtr.h"
#include "nsIDirectoryEnumerator.h"
#include "nsIFile.h"
#include "nsLocalFile.h"
#include "nsProxyRelease.h"
#include "nsString.h"
#include "nsTArray.h"
#include "nsThreadUtils.h"
#include "nsUnicharUtils.h"

#if defined(XP_WIN)
#  include <windows.h>
#endif

namespace zen {

namespace {

/**
 * @brief A file the walk kept, before it is handed over to the caller.
 */
struct FoundFile {
  nsString mPath;
  nsString mRoot;
  int64_t mLastModified = 0;
  int64_t mSize = 0;
  bool mCloudPlaceholder = false;
};

/**
 * @brief Implementation of the nsIZenMediaFile interface.
 */
class ZenMediaFile final : public nsIZenMediaFile {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENMEDIAFILE

 public:
  explicit ZenMediaFile(const FoundFile& aFile)
      : mPath(aFile.mPath),
        mRoot(aFile.mRoot),
        mLastModified(aFile.mLastModified),
        mSize(aFile.mSize),
        mCloudPlaceholder(aFile.mCloudPlaceholder) {}

 private:
  ~ZenMediaFile() = default;

  const nsString mPath;
  const nsString mRoot;
  const int64_t mLastModified;
  const int64_t mSize;
  const bool mCloudPlaceholder;
};

NS_IMPL_ISUPPORTS(ZenMediaFile, nsIZenMediaFile)

NS_IMETHODIMP
ZenMediaFile::GetPath(nsAString& aPath) {
  aPath = mPath;
  return NS_OK;
}

NS_IMETHODIMP
ZenMediaFile::GetRoot(nsAString& aRoot) {
  aRoot = mRoot;
  return NS_OK;
}

NS_IMETHODIMP
ZenMediaFile::GetLastModified(int64_t* aLastModified) {
  NS_ENSURE_ARG_POINTER(aLastModified);
  *aLastModified = mLastModified;
  return NS_OK;
}

NS_IMETHODIMP
ZenMediaFile::GetSize(int64_t* aSize) {
  NS_ENSURE_ARG_POINTER(aSize);
  *aSize = mSize;
  return NS_OK;
}

NS_IMETHODIMP
ZenMediaFile::GetCloudPlaceholder(bool* aCloudPlaceholder) {
  NS_ENSURE_ARG_POINTER(aCloudPlaceholder);
  *aCloudPlaceholder = mCloudPlaceholder;
  return NS_OK;
}

/**
 * @brief Whether the bytes of a file are kept somewhere else, so that
 * reading it is what brings them over.
 * @param aPath The absolute path of the file to look at.
 */
bool IsPathCloudPlaceholder(const nsAString& aPath) {
#if defined(XP_WIN)
  if (aPath.IsEmpty()) {
    return false;
  }
  const nsString& path = PromiseFlatString(aPath);
  DWORD attributes = ::GetFileAttributesW(path.get());
  if (attributes == INVALID_FILE_ATTRIBUTES) {
    return false;
  }
  return (attributes & (FILE_ATTRIBUTE_OFFLINE | FILE_ATTRIBUTE_RECALL_ON_OPEN |
                        FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS)) != 0;
#else
  // Other systems keep their stand-ins under a name of their own, such as
  // the dotted files iCloud leaves behind, which a scan passes over anyway.
  return false;
#endif
}

/**
 * @brief Whether a name ends in one of the extensions asked for.
 * @param aLeafName The name of the file, without its folder.
 * @param aExtensions Lowercased extensions, without the dot.
 */
bool HasWantedExtension(const nsAString& aLeafName,
                        const nsTArray<nsString>& aExtensions) {
  int32_t dot = aLeafName.RFindChar(u'.');
  if (dot <= 0) {
    return false;
  }
  nsAutoString extension(Substring(aLeafName, dot + 1));
  ToLowerCase(extension);
  return aExtensions.Contains(extension);
}

/**
 * @brief Look through one folder, and then through the folders in it.
 * @param aFolder The folder to look through.
 * @param aRoot The folder the scan started from, kept with what it finds.
 * @param aDepth How far below the root this folder is.
 * @param aMaxDepth How far below the root to go at all.
 * @param aFoldersLeft How many folders the scan may still open.
 * @param aExtensions The extensions a file must have to be kept.
 * @param aFound Collects what the walk keeps.
 */
void WalkFolder(nsIFile* aFolder, const nsAString& aRoot, uint32_t aDepth,
                uint32_t aMaxDepth, uint32_t& aFoldersLeft,
                const nsTArray<nsString>& aExtensions,
                nsTArray<FoundFile>& aFound) {
  if (aDepth > aMaxDepth || aFoldersLeft == 0) {
    return;
  }
  aFoldersLeft--;

  nsCOMPtr<nsIDirectoryEnumerator> entries;
  if (NS_FAILED(aFolder->GetDirectoryEntries(getter_AddRefs(entries))) ||
      !entries) {
    return;
  }

  nsTArray<nsCOMPtr<nsIFile>> folders;
  while (true) {
    nsCOMPtr<nsIFile> entry;
    if (NS_FAILED(entries->GetNextFile(getter_AddRefs(entry))) || !entry) {
      break;
    }
    nsAutoString leafName;
    if (NS_FAILED(entry->GetLeafName(leafName)) || leafName.IsEmpty() ||
        leafName.First() == u'.') {
      continue;
    }
    bool isDirectory = false;
    if (NS_SUCCEEDED(entry->IsDirectory(&isDirectory)) && isDirectory) {
      bool isSymlink = false;
      // A folder with a suffix is a bundle on macOS, which holds the parts
      // of one thing rather than files of its own. A link can point back up
      // the tree, and no folder is worth going round in circles for.
      if (leafName.RFindChar(u'.') <= 0 &&
          NS_SUCCEEDED(entry->IsSymlink(&isSymlink)) && !isSymlink) {
        folders.AppendElement(entry);
      }
      continue;
    }
    if (!HasWantedExtension(leafName, aExtensions)) {
      continue;
    }
    FoundFile found;
    if (NS_FAILED(entry->GetPath(found.mPath))) {
      continue;
    }
    found.mRoot = aRoot;
    PRTime lastModified = 0;
    if (NS_SUCCEEDED(entry->GetLastModifiedTime(&lastModified))) {
      found.mLastModified = lastModified;
    }
    int64_t size = 0;
    if (NS_SUCCEEDED(entry->GetFileSize(&size))) {
      found.mSize = size;
    }
    found.mCloudPlaceholder = IsPathCloudPlaceholder(found.mPath);
    aFound.AppendElement(std::move(found));
  }
  entries->Close();

  for (const nsCOMPtr<nsIFile>& folder : folders) {
    WalkFolder(folder, aRoot, aDepth + 1, aMaxDepth, aFoldersLeft, aExtensions,
               aFound);
  }
}

}  // namespace

NS_IMPL_ISUPPORTS(nsZenLibraryFiles, nsIZenLibraryFiles)

NS_IMETHODIMP
nsZenLibraryFiles::IsCloudPlaceholder(const nsAString& aPath,
                                      bool* aIsPlaceholder) {
  NS_ENSURE_ARG_POINTER(aIsPlaceholder);
  *aIsPlaceholder = IsPathCloudPlaceholder(aPath);
  return NS_OK;
}

NS_IMETHODIMP
nsZenLibraryFiles::ScanMedia(const nsTArray<nsString>& aRoots,
                             const nsTArray<nsString>& aExtensions,
                             uint32_t aMaxDepth, uint32_t aMaxFolders,
                             uint32_t aMaxItems,
                             nsIZenMediaScanCallback* aCallback) {
  NS_ENSURE_ARG_POINTER(aCallback);
  NS_ENSURE_TRUE(NS_IsMainThread(), NS_ERROR_NOT_SAME_THREAD);

  nsMainThreadPtrHandle<nsIZenMediaScanCallback> callback(
      new nsMainThreadPtrHolder<nsIZenMediaScanCallback>(
          "zen::MediaScanCallback", aCallback));

  nsTArray<nsString> roots(aRoots.Clone());
  nsTArray<nsString> extensions(aExtensions.Clone());
  for (nsString& extension : extensions) {
    ToLowerCase(extension);
  }

  return NS_DispatchBackgroundTask(
      NS_NewRunnableFunction(
          "zen::ScanMedia",
          [roots = std::move(roots), extensions = std::move(extensions),
           aMaxDepth, aMaxFolders, aMaxItems, callback]() mutable {
            nsTArray<FoundFile> found;
            uint32_t foldersLeft = aMaxFolders;
            for (const nsString& root : roots) {
              nsCOMPtr<nsIFile> folder;
              if (NS_FAILED(NS_NewLocalFile(root, getter_AddRefs(folder))) ||
                  !folder) {
                continue;
              }
              WalkFolder(folder, root, 0, aMaxDepth, foldersLeft, extensions,
                         found);
            }
            std::sort(found.begin(), found.end(),
                      [](const FoundFile& aLeft, const FoundFile& aRight) {
                        return aLeft.mLastModified > aRight.mLastModified;
                      });
            if (found.Length() > aMaxItems) {
              found.TruncateLength(aMaxItems);
            }
            NS_DispatchToMainThread(NS_NewRunnableFunction(
                "zen::ScanMediaDone", [found = std::move(found), callback]() {
                  nsTArray<RefPtr<nsIZenMediaFile>> files(found.Length());
                  for (const FoundFile& file : found) {
                    files.AppendElement(new ZenMediaFile(file));
                  }
                  callback->OnMediaScanned(files);
                }));
          }),
      nsIEventTarget::DISPATCH_EVENT_MAY_BLOCK);
}

}  // namespace zen
