/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "mozilla/dom/BrowsingContext.h"
#include "nsPIDOMWindow.h"

namespace mozilla::dom {

// Hard limit for the tab volume. The frontend uses a lower maximum. This one
// only keeps absurd gains out of the audio pipeline.
static constexpr float kMaxZenMediaVolume = 4.0f;

/**
 * @brief Only the parent process may change the tab volume, and only to a
 * value within [0, kMaxZenMediaVolume]. NaN fails both comparisons.
 */
bool BrowsingContext::CanSet(FieldIndex<IDX_ZenMediaVolume>,
                             const float& aValue, ContentParent* aSource) {
  return CheckOnlyParentProcessCanSet(aSource) && aValue >= 0.0f &&
         aValue <= kMaxZenMediaVolume;
}

/**
 * @brief Called in every process hosting part of this tab when the tab volume
 * changes. Pushes the new volume to all audio channel agents (media elements,
 * Web Audio destinations, speech synthesis) of the in-process windows, the
 * same way the tab mute state is propagated.
 * @param aOldValue The previous volume.
 */
void BrowsingContext::DidSet(FieldIndex<IDX_ZenMediaVolume>, float aOldValue) {
  MOZ_ASSERT(IsTop());
  if (ZenMediaVolume() == aOldValue) {
    return;
  }
  PreOrderWalk([](BrowsingContext* aContext) {
    if (nsPIDOMWindowOuter* win = aContext->GetDOMWindow()) {
      win->RefreshMediaElementsVolume();
    }
  });
}

}  // namespace mozilla::dom
