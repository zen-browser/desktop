/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_ZenBoostsBackend_h_
#define mozilla_ZenBoostsBackend_h_

#include "nsColor.h"
#include "nsIObserver.h"
#include "nsIZenBoostsBackend.h"
#include "nsZenBoostData.h"
#include "nsPresContext.h"
#include "nsString.h"
#include "nsTArray.h"
#include "nsTHashMap.h"

class nsIFrame;
class nsIURI;

namespace mozilla::dom {
class BrowsingContext;
class CanonicalBrowsingContext;
class ContentParent;
}  // namespace mozilla::dom

#define ZEN_BOOSTS_BACKEND_CONTRACTID "@mozilla.org/zen/boosts-backend;1"

using ZenBoostData = nscolor;  // For now, Zen boosts data is just a color.

namespace zen {

struct nsZenAccentOklab {
  nscolor accentNS;
  float accL, accA, accB;
  float contrastFactor;
};

#ifdef ENABLE_TESTS
// Test-only forwarders into the file-local color math and accent cache.
namespace detail {
nsZenAccentOklab PrecomputeAccent(nscolor aAccentColor);
nsZenAccentOklab RotateAccent(const nsZenAccentOklab& aBase,
                              float aRotationDeg);
nscolor FilterColorChannel(nscolor aOriginalColor,
                           const nsZenAccentOklab& aAccent,
                           const nsZenAccentOklab& aComplementary);
nscolor InvertColorChannel(nscolor aColor);

size_t AccentCacheSize();
void ResetAccentCache();
bool IsAccentCached(nscolor aAccentNS, float aRotationDeg);
void EnsureCachedAccent(nscolor aAccentNS, float aRotationDeg);
}  // namespace detail
#endif  // ENABLE_TESTS

class nsZenBoostsBackend final : public nsIZenBoostsBackend,
                                 public nsIObserver {
 public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIZENBOOSTSBACKEND
  NS_DECL_NSIOBSERVER

  nsZenBoostsBackend() = default;

  /**
   * @brief Starts tracking document loads. Called once by the component
   * manager when the service is first requested.
   */
  nsresult Init();

  /**
   * @brief Resolve a color to take into account Zen boosts. This is the single
   * place style colors are filtered; it is reached for every style color via
   * StyleAbsoluteColor::ToColor. Do not add a second StyleColor::ResolveColor
   * filter on top of this or colors get filtered multiple times (which also
   * makes resting colors disagree with composited transition endpoints).
   *
   * The boost state is derived from the frame the color is being resolved for:
   * its document's top BrowsingContext carries the accent/inversion data. When
   * @p aFrame is null, or belongs to anonymous content (devtools, screenshots,
   * the boosts overlays themselves), the color is returned unfiltered.
   * @param aColor The color to resolve.
   * @param aFrame The frame the color is being resolved for, or null.
   * @return The resolved color with Zen boost filters applied, or the original
   * color if no boost is active.
   * @see StyleAbsoluteColor::ToColor for reference.
   */
  static auto ResolveStyleColor(nscolor aColor, const nsIFrame* aFrame)
      -> nscolor;

  /**
   * @brief Sets, replaces or removes the boost stylesheet of a domain in this
   * content process, and updates the documents of that domain it is showing.
   * Documents loaded afterwards pick the sheet up when they are created.
   * Reached from ContentChild::RecvZenUpdateBoostStyleSheet.
   * @param aDomain The host the stylesheet applies to.
   * @param aStyleSheet The stylesheet as a data.
   */
  static void UpdateContentStyleSheet(const nsACString& aDomain,
                                      const nsACString& aStyleSheet);

 private:
  ~nsZenBoostsBackend() = default;

  /**
   * @brief Looks up the boost registered for the host of a URI.
   */
  const nsZenBoost* LookupBoost(nsIURI* aURI) const;

  /**
   * @brief Pushes the colors of the boost of the document a top-level content
   * context is showing, or the lack of one, to that context.
   */
  void ApplyToBrowsingContext(mozilla::dom::CanonicalBrowsingContext* aContext);

  /**
   * @brief Sends the stylesheet of a domain to a content process, unless it
   * was already sent it. Called when the process shows a page of the domain.
   */
  void EnsureProcessHasStyleSheet(mozilla::dom::ContentParent* aProcess,
                                  const nsACString& aDomain,
                                  const nsACString& aStyleSheet);

  /**
   * @brief Sends a changed stylesheet to the content processes that hold the
   * previous one for that domain. No other process is told.
   * @param aStyleSheet The data: URI spec, empty when the domain has none.
   */
  void UpdateStyleSheetHolders(const nsACString& aDomain,
                               const nsACString& aStyleSheet);

  /**
   * @brief Re-applies boosts to every open top-level content context accepted
   * by the filter, which receives the boost of the context, if any.
   */
  template <typename Filter>
  void ApplyToOpenPages(Filter&& aFilter);

  nsTHashMap<nsCStringHashKey, nsZenBoost> mBoosts;
  // The child ids of the content processes holding the stylesheet of each
  // domain, so that changes only go to the processes that need them.
  nsTHashMap<nsCStringHashKey, nsTArray<uint64_t>> mStyleSheetHolders;
  // Keyed by the id of the top chrome BrowsingContext of each browser window.
  nsTHashMap<nsUint64HashKey, nscolor> mWorkspaceAccents;
};

}  // namespace zen

#endif
