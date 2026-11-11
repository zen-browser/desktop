/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsZenBoostsContentSheets.h"
#include "nsZenBoostData.h"

#include "nsIObserverService.h"
#include "nsNetUtil.h"

#include "mozilla/ClearOnShutdown.h"
#include "mozilla/ServoStyleConsts.h"
#include "mozilla/Services.h"
#include "mozilla/StaticPtr.h"
#include "mozilla/css/Loader.h"

#include "mozilla/dom/BrowsingContext.h"
#include "mozilla/dom/BrowsingContextGroup.h"
#include "mozilla/dom/Document.h"

namespace zen {

using mozilla::dom::BrowsingContext;
using mozilla::dom::BrowsingContextGroup;
using mozilla::dom::Document;

NS_IMPL_ISUPPORTS(nsZenBoostsContentSheets, nsIObserver)

static mozilla::StaticRefPtr<nsZenBoostsContentSheets> sContentSheets;

nsZenBoostsContentSheets* nsZenBoostsContentSheets::Get() {
  if (!sContentSheets) {
    sContentSheets = new nsZenBoostsContentSheets();
    mozilla::ClearOnShutdown(&sContentSheets);
    if (nsCOMPtr<nsIObserverService> obs =
            mozilla::services::GetObserverService()) {
      obs->AddObserver(sContentSheets, "document-element-inserted", false);
    }
  }
  return sContentSheets;
}

NS_IMETHODIMP
nsZenBoostsContentSheets::Observe(nsISupports* aSubject, const char* aTopic,
                                  const char16_t* aData) {
  if (mSheets.IsEmpty()) {
    return NS_OK;
  }
  nsCOMPtr<Document> document = do_QueryInterface(aSubject);
  if (!document) {
    return NS_OK;
  }
  // Loading sheets into subframes is not supported.
  BrowsingContext* context = document->GetBrowsingContext();
  if (context && context->IsTopContent()) {
    AttachTo(*document);
  }
  return NS_OK;
}

void nsZenBoostsContentSheets::AttachTo(Document& aDocument) {
  nsAutoCString host;
  GetBoostHost(aDocument.GetDocumentURI(), host);
  if (host.IsEmpty()) {
    return;
  }
  auto entry = mSheets.Lookup(host);
  if (!entry) {
    return;
  }
  if (!entry->parsed) {
    RefPtr<mozilla::css::Loader> loader = new mozilla::css::Loader;
    auto result =
        loader->LoadSheetSync(entry->uri, mozilla::StyleOrigin::User,
                              mozilla::css::Loader::UseSystemPrincipal::Yes);
    if (result.isErr()) {
      return;
    }
    entry->parsed = result.unwrap();
  }
  aDocument.RemoveAdditionalStyleSheet(Document::eUserSheet, entry->uri);
  RefPtr<mozilla::StyleSheet> sheet = entry->parsed->Clone(nullptr, nullptr);
  (void)aDocument.AddAdditionalStyleSheet(Document::eUserSheet, sheet);
}

void nsZenBoostsContentSheets::Update(const nsACString& aDomain,
                                      const nsACString& aSpec) {
  nsCOMPtr<nsIURI> previous;
  if (auto entry = mSheets.Lookup(aDomain)) {
    if (entry->spec == aSpec) {
      return;
    }
    previous = entry->uri;
  }

  Entry updated;
  updated.spec = aSpec;
  if (!aSpec.IsEmpty() &&
      NS_SUCCEEDED(NS_NewURI(getter_AddRefs(updated.uri), aSpec))) {
    mSheets.InsertOrUpdate(aDomain, std::move(updated));
  } else {
    mSheets.Remove(aDomain);
  }

  nsTArray<RefPtr<BrowsingContextGroup>> groups;
  BrowsingContextGroup::GetAllGroups(groups);
  for (const auto& group : groups) {
    for (const auto& context : group->Toplevels()) {
      if (context->IsDiscarded() || !context->IsTopContent() ||
          !context->IsInProcess()) {
        continue;
      }
      RefPtr<Document> document = context->GetExtantDocument();
      if (!document) {
        continue;
      }
      nsAutoCString host;
      GetBoostHost(document->GetDocumentURI(), host);
      if (host != aDomain) {
        continue;
      }
      if (previous) {
        document->RemoveAdditionalStyleSheet(Document::eUserSheet, previous);
      }
      AttachTo(*document);
    }
  }
}

}  // namespace zen
