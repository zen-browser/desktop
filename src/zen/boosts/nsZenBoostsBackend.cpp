/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenBoostsBackend.h"

#include "nsIXULRuntime.h"
#include "mozilla/PresShell.h"
#include "nsPresContext.h"

namespace zen {

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenBoostsBackend, nsIZenBoostsBackend)

nsZenBoostsBackend::nsZenBoostsBackend() {};

nsPresContext* nsZenBoostsBackend::mCurrentPresContext = nullptr;

} // namespace zen
