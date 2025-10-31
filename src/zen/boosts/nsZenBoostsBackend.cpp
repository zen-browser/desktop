/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenBoostsBackend.h"

#include "nsIXULRuntime.h"
#include "nsPresContext.h"

#include "mozilla/RefPtr.h"
#include "mozilla/StaticPtr.h"

#include "mozilla/ServoStyleConsts.h"
#include "mozilla/ServoStyleConstsInlines.h"

#include "mozilla/dom/Document.h"
#include "mozilla/dom/BrowsingContext.h"

using BrowsingContext = mozilla::dom::BrowsingContext;
using BoostData = nscolor; // For now, Zen boosts data is just a color.

void BrowsingContext::DidSet(FieldIndex<IDX_ZenBoostsData>,
                                          BoostData aOldValue) {
  MOZ_ASSERT(IsTop());
  if (ZenBoostsData() == aOldValue) {
    return;
  }
  PresContextAffectingFieldChanged();
}

namespace zen {
namespace {

// llvm x86 is poor at ternary operator, so use branchless min/max.
static __inline int32_t clamp255(int32_t v) {
  return (((255 - (v)) >> 31) | (v)) & 255;
}

} // namespace

// Use the macro to inject all of the definitions for nsISupports.
NS_IMPL_ISUPPORTS(nsZenBoostsBackend, nsIZenBoostsBackend)
nsZenBoostsBackend::nsZenBoostsBackend() {};

auto nsZenBoostsBackend::onPressShellEntered(nsPresContext* aPresContext) -> void {
  if (!aPresContext) {
    return;
  }

  mCurrentPresContext = aPresContext;
}

auto nsZenBoostsBackend::onPressShellLeave(nsPresContext* aPresContext) -> void {
  // TODO: We should set it as a null as well, but this prevents borders and shadows
  // from being drawn into our Zen boosts modifications.
  if (!aPresContext) {
    return;
  }
  mCurrentPresContext = aPresContext;
}

auto nsZenBoostsBackend::RecomputeBrowsingContextDependentData(
    nsPresContext* aPresContext, mozilla::dom::BrowsingContext* aBrowsingContext) -> void {
  if (!aPresContext || aPresContext->IsChrome()) {
    return;
  }

  aPresContext->mZenBoostsPresContextData = aBrowsingContext->ZenBoostsData();
}

auto nsZenBoostsBackend::ResolveStyleColor(
    mozilla::StyleAbsoluteColor aColor) -> mozilla::StyleAbsoluteColor {
  static nsCOMPtr<zen::nsZenBoostsBackend> zenBoosts(
      do_GetService(ZEN_BOOSTS_BACKEND_CONTRACTID));

  if (zenBoosts) {
    if (auto presContext = zenBoosts->mCurrentPresContext) {
      if (auto accentNS = presContext->mZenBoostsPresContextData) {
        // Apply a filter-like tint:
        // - Preserve the original color's perceived luminance
        // - Map hue/chroma toward the accent by scaling the accent's RGB
        //   to match the original luminance
        // - Keep the original alpha

        // Convert both colors to nscolor to access channels
        nscolor originalNS = aColor.ToColor();

        auto r1 = NS_GET_R(originalNS);
        auto g1 = NS_GET_G(originalNS);
        auto b1 = NS_GET_B(originalNS);

        auto r2 = NS_GET_R(accentNS);
        auto g2 = NS_GET_G(accentNS);
        auto b2 = NS_GET_B(accentNS);

        // Approximate perceived luminance in sRGB space
        // Coefficients per Rec.709; gamma correction ignored for speed
        double origLum = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
        double accentLum = 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;

        double scale = accentLum > 0.0 ? (origLum / accentLum) : 1.0;

        uint8_t fr = clamp255(r2 * scale);
        uint8_t fg = clamp255(g2 * scale);
        uint8_t fb = clamp255(b2 * scale);

        nscolor filteredNS = NS_RGBA(fr, fg, fb, 1);
        auto filtered = mozilla::StyleAbsoluteColor::FromColor(filteredNS);
        filtered.alpha = aColor.alpha;
        return filtered;
      }
    }
  }

  return aColor;
}

} // namespace zen
