/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_nsZenLibraryFiles_h_
#define mozilla_nsZenLibraryFiles_h_

#include "nsIZenLibraryFiles.h"

#define ZEN_LIBRARY_FILES_CONTRACTID "@mozilla.org/zen/library-files;1"

namespace zen {

/**
 * @brief Implementation of the nsIZenLibraryFiles interface.
 */
class nsZenLibraryFiles final : public nsIZenLibraryFiles {
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENLIBRARYFILES

 public:
  explicit nsZenLibraryFiles() = default;

 private:
  ~nsZenLibraryFiles() = default;
};

}  // namespace zen

#endif
