/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenBoostsBackend.h"

#include "nsIXULRuntime.h"
#include "nsPresContext.h"

#include "mozilla/StaticPtr.h"

#include "mozilla/MediaFeatureChange.h"

#include "mozilla/dom/Document.h"
#include "mozilla/dom/DocumentInlines.h"
#include "mozilla/dom/BrowsingContext.h"

#define MARK_MEDIA_FEATURE_CHANGED(_pc)                                \
  (_pc)->MediaFeatureValuesChanged(                                    \
      {mozilla::RestyleHint::RecascadeSubtree(), NS_STYLE_HINT_VISUAL, \
       mozilla::MediaFeatureChangeReason::PreferenceChange},           \
      mozilla::MediaFeatureChangePropagation::All);

#define TRIGGER_PRES_CONTEXT_RESTYLE() \
  WalkPresContexts(                    \
      [&](nsPresContext* aPc) { MARK_MEDIA_FEATURE_CHANGED(aPc); });

using BrowsingContext = mozilla::dom::BrowsingContext;

template <typename Callback>
void BrowsingContext::WalkPresContexts(Callback&& aCallback) {
  PreOrderWalk([&](BrowsingContext* aContext) {
    if (nsIDocShell* shell = aContext->GetDocShell()) {
      if (RefPtr pc = shell->GetPresContext()) {
        aCallback(pc.get());
      }
    }
  });
}

static void RefreshBoostCacheIfMatchesCurrent(BrowsingContext* aChanged) {
  auto* backend = zen::nsZenBoostsBackend::GetInstance();
  if (!backend) {
    return;
  }
  RefPtr<BrowsingContext> current = backend->GetCurrentBrowsingContext();
  if (!current || current->Top() != aChanged) {
    return;
  }
  backend->RefreshCachedBoostState();
}

/**
 * @brief Called when the ZenBoostsData field is set on a browsing context.
 * Triggers a restyle if the boost data has changed.
 * @param aOldValue The previous value of the boost data.
 */
void BrowsingContext::DidSet(FieldIndex<IDX_ZenBoostsData>,
                             ZenBoostData aOldValue) {
  MOZ_ASSERT(IsTop());
  if (ZenBoostsData() == aOldValue) {
    return;
  }
  RefreshBoostCacheIfMatchesCurrent(this);
  PresContextAffectingFieldChanged();
  TRIGGER_PRES_CONTEXT_RESTYLE();
}

/**
 * @brief Called when the ZenBoostsComplementaryRotation field is set on a
 * browsing context. This is the hue rotation (in degrees) applied to the base
 * accent to derive the complementary accent that light page colors are tinted
 * toward. Triggers a restyle if it has changed.
 * @param aOldValue The previous rotation value.
 */
void BrowsingContext::DidSet(FieldIndex<IDX_ZenBoostsComplementaryRotation>,
                             float aOldValue) {
  MOZ_ASSERT(IsTop());
  if (ZenBoostsComplementaryRotation() == aOldValue) {
    return;
  }
  RefreshBoostCacheIfMatchesCurrent(this);
  PresContextAffectingFieldChanged();
  TRIGGER_PRES_CONTEXT_RESTYLE();
}

/**
 * @brief Called when the IsZenBoostsInverted field is set on a browsing
 * context. Triggers a restyle if the value has changed.
 * @param aOldValue The previous value of the IsZenBoostsInverted flag.
 */
void BrowsingContext::DidSet(FieldIndex<IDX_IsZenBoostsInverted>,
                             bool aOldValue) {
  MOZ_ASSERT(IsTop());
  if (IsZenBoostsInverted() == aOldValue) {
    return;
  }
  RefreshBoostCacheIfMatchesCurrent(this);
  PresContextAffectingFieldChanged();
  TRIGGER_PRES_CONTEXT_RESTYLE();
}
