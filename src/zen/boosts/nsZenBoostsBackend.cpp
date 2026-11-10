/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenBoostsBackend.h"
#include "nsZenBoostsContentSheets.h"
#include "nsZenBoostsStyle.h"

#include "nsIObserverService.h"
#include "nsIURI.h"

#include "mozilla/Services.h"

#include "mozilla/dom/BrowsingContext.h"
#include "mozilla/dom/BrowsingContextGroup.h"
#include "mozilla/dom/CanonicalBrowsingContext.h"
#include "mozilla/dom/ContentParent.h"
#include "mozilla/dom/WindowGlobalParent.h"

namespace zen {

NS_IMPL_ISUPPORTS(nsZenBoostsBackend, nsIZenBoostsBackend, nsIObserver)

namespace {

using mozilla::dom::BrowsingContext;
using mozilla::dom::BrowsingContextGroup;
using mozilla::dom::CanonicalBrowsingContext;
using mozilla::dom::ContentParent;
using mozilla::dom::WindowContext;
using mozilla::dom::WindowGlobalParent;

static nsIURI* GetCurrentURI(CanonicalBrowsingContext* aContext) {
  WindowGlobalParent* windowGlobal = aContext->GetCurrentWindowGlobal();
  return windowGlobal ? windowGlobal->GetDocumentURI() : nullptr;
}

}  // namespace

nsresult nsZenBoostsBackend::Init() {
  nsCOMPtr<nsIObserverService> obs = mozilla::services::GetObserverService();
  NS_ENSURE_TRUE(obs, NS_ERROR_UNEXPECTED);
  return obs->AddObserver(this, "window-global-created", false);
}

void nsZenBoostsBackend::EnsureProcessHasStyleSheet(
    ContentParent* aProcess, const nsACString& aDomain,
    const nsACString& aStyleSheet) {
  const uint64_t childID = uint64_t(aProcess->ChildID());
  nsTArray<uint64_t>& holders = mStyleSheetHolders.LookupOrInsert(aDomain);
  if (holders.Contains(childID)) {
    return;
  }
  holders.AppendElement(childID);
  (void)aProcess->SendZenUpdateBoostStyleSheet(nsCString(aDomain),
                                               nsCString(aStyleSheet));
}

void nsZenBoostsBackend::UpdateStyleSheetHolders(
    const nsACString& aDomain, const nsACString& aStyleSheet) {
  auto holders = mStyleSheetHolders.Lookup(aDomain);
  if (!holders) {
    return;
  }
  const nsCString domain(aDomain);
  const nsCString styleSheet(aStyleSheet);
  nsTArray<uint64_t> live;
  for (ContentParent* process :
       ContentParent::AllProcesses(ContentParent::eLive)) {
    const uint64_t childID = uint64_t(process->ChildID());
    if (holders->Contains(childID)) {
      (void)process->SendZenUpdateBoostStyleSheet(domain, styleSheet);
      live.AppendElement(childID);
    }
  }
  if (styleSheet.IsEmpty() || live.IsEmpty()) {
    holders.Remove();
  } else {
    holders.Data() = std::move(live);
  }
}

void nsZenBoostsBackend::UpdateContentStyleSheet(
    const nsACString& aDomain, const nsACString& aStyleSheet) {
  nsZenBoostsContentSheets::Get()->Update(aDomain, aStyleSheet);
}

NS_IMETHODIMP
nsZenBoostsBackend::Observe(nsISupports* aSubject, const char* aTopic,
                            const char16_t* aData) {
  if (!strcmp(aTopic, "window-global-created") && aSubject) {
    WindowGlobalParent* windowGlobal =
        static_cast<WindowContext*>(aSubject)->Canonical();
    ApplyToBrowsingContext(windowGlobal->BrowsingContext());
  }
  return NS_OK;
}

const nsZenBoost* nsZenBoostsBackend::LookupBoost(nsIURI* aURI) const {
  nsAutoCString host;
  GetBoostHost(aURI, host);
  if (host.IsEmpty()) {
    return nullptr;
  }
  if (auto entry = mBoosts.Lookup(host)) {
    return &entry.Data();
  }
  return nullptr;
}

void nsZenBoostsBackend::ApplyToBrowsingContext(
    CanonicalBrowsingContext* aContext) {
  if (!aContext || aContext->IsDiscarded() || !aContext->IsTopContent()) {
    return;
  }
  RefPtr<WindowGlobalParent> windowGlobal = aContext->GetCurrentWindowGlobal();
  if (!windowGlobal) {
    return;
  }

  nscolor accent = 0;
  float complementaryRotation = 0.0f;
  bool inverted = false;

  nsAutoCString host;
  GetBoostHost(windowGlobal->GetDocumentURI(), host);
  const nsZenBoost* boost = LookupBoost(windowGlobal->GetDocumentURI());
  const bool hasBoost = !!boost;
  if (boost) {
    if (!boost->styleSheet.IsEmpty()) {
      if (ContentParent* process = windowGlobal->GetContentParent()) {
        EnsureProcessHasStyleSheet(process, host, boost->styleSheet);
      }
    }
    inverted = boost->smartInvert;
    if (boost->colorEnabled) {
      float hueDeg = boost->hueDeg;
      if (boost->autoTheme) {
        hueDeg = 0.0f;
        if (CanonicalBrowsingContext* chrome =
                aContext->TopCrossChromeBoundary()) {
          if (auto workspaceAccent = mWorkspaceAccents.MaybeGet(chrome->Id())) {
            hueDeg = detail::HueOfColor(*workspaceAccent);
          }
        }
      }
      accent = detail::BuildAccentColor(hueDeg, *boost);
      complementaryRotation = boost->complementaryRotation;
    }
  }
  // The observers notified below may change the registry.
  boost = nullptr;

  BrowsingContext::Transaction txn;
  bool changed = false;
  if (aContext->ZenBoostsData() != accent) {
    txn.SetZenBoostsData(accent);
    changed = true;
  }
  if (aContext->ZenBoostsComplementaryRotation() != complementaryRotation) {
    txn.SetZenBoostsComplementaryRotation(complementaryRotation);
    changed = true;
  }
  if (aContext->IsZenBoostsInverted() != inverted) {
    txn.SetIsZenBoostsInverted(inverted);
    changed = true;
  }
  if (changed) {
    (void)txn.Commit(aContext);
  }

  if (hasBoost) {
    if (nsCOMPtr<nsIObserverService> obs =
            mozilla::services::GetObserverService()) {
      obs->NotifyObservers(ToSupports(windowGlobal), "zen-boost-applied",
                           nullptr);
    }
  }
}

template <typename Filter>
void nsZenBoostsBackend::ApplyToOpenPages(Filter&& aFilter) {
  nsTArray<RefPtr<BrowsingContextGroup>> groups;
  BrowsingContextGroup::GetAllGroups(groups);
  for (const auto& group : groups) {
    const nsTArray<RefPtr<BrowsingContext>> toplevels =
        group->Toplevels().Clone();
    for (const auto& context : toplevels) {
      if (context->IsDiscarded() || !context->IsTopContent()) {
        continue;
      }
      CanonicalBrowsingContext* canonical = context->Canonical();
      nsAutoCString host;
      GetBoostHost(GetCurrentURI(canonical), host);
      const nsZenBoost* boost = nullptr;
      if (!host.IsEmpty()) {
        if (auto entry = mBoosts.Lookup(host)) {
          boost = &entry.Data();
        }
      }
      if (aFilter(host, boost)) {
        ApplyToBrowsingContext(canonical);
      }
    }
  }
}

NS_IMETHODIMP
nsZenBoostsBackend::SetBoostForDomain(const nsACString& aDomain,
                                      JS::Handle<JS::Value> aBoostData,
                                      JSContext* aCx) {
  if (aDomain.IsEmpty() || !aBoostData.isObject()) {
    return NS_ERROR_INVALID_ARG;
  }
  nsZenBoost boost;
  if (!ReadBoostData(aCx, aBoostData, boost)) {
    return NS_ERROR_FAILURE;
  }
  nsCString previousStyleSheet;
  if (auto previous = mBoosts.Lookup(aDomain)) {
    previousStyleSheet = previous->styleSheet;
  }
  const nsCString styleSheet = boost.styleSheet;
  mBoosts.InsertOrUpdate(aDomain, std::move(boost));
  if (styleSheet != previousStyleSheet) {
    UpdateStyleSheetHolders(aDomain, styleSheet);
  }
  ApplyToOpenPages([&](const nsACString& aHost, const nsZenBoost*) {
    return aHost == aDomain;
  });
  return NS_OK;
}

NS_IMETHODIMP
nsZenBoostsBackend::RemoveBoostForDomain(const nsACString& aDomain) {
  mozilla::Maybe<nsZenBoost> removed = mBoosts.Extract(aDomain);
  if (!removed) {
    return NS_OK;
  }
  UpdateStyleSheetHolders(aDomain, ""_ns);
  ApplyToOpenPages([&](const nsACString& aHost, const nsZenBoost*) {
    return aHost == aDomain;
  });
  return NS_OK;
}

NS_IMETHODIMP
nsZenBoostsBackend::RemoveAllBoosts() {
  if (mBoosts.IsEmpty()) {
    return NS_OK;
  }
  for (const auto& entry : mBoosts) {
    UpdateStyleSheetHolders(entry.GetKey(), ""_ns);
  }
  mBoosts.Clear();
  ApplyToOpenPages([](const nsACString&, const nsZenBoost*) { return true; });
  return NS_OK;
}

NS_IMETHODIMP
nsZenBoostsBackend::SetWorkspaceAccent(BrowsingContext* aChromeBrowsingContext,
                                       uint8_t aRed, uint8_t aGreen,
                                       uint8_t aBlue) {
  NS_ENSURE_ARG(aChromeBrowsingContext);
  const uint64_t windowId = aChromeBrowsingContext->Top()->Id();
  const nscolor color = NS_RGB(aRed, aGreen, aBlue);
  if (auto current = mWorkspaceAccents.MaybeGet(windowId);
      current && *current == color) {
    return NS_OK;
  }

  // Forget the windows that were closed since the last update.
  for (auto iter = mWorkspaceAccents.Iter(); !iter.Done(); iter.Next()) {
    RefPtr<BrowsingContext> window = BrowsingContext::Get(iter.Key());
    if (!window || window->IsDiscarded()) {
      iter.Remove();
    }
  }
  mWorkspaceAccents.InsertOrUpdate(windowId, color);

  ApplyToOpenPages([](const nsACString&, const nsZenBoost* aBoost) {
    return aBoost && aBoost->colorEnabled && aBoost->autoTheme;
  });
  return NS_OK;
}

}  // namespace zen
