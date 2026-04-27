/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include "mozilla/dom/Document.h"
#include "nsContentUtils.h"
#include "nsGlobalWindowOuter.h"
#include "nsIWindowMediator.h"
#include "nsPIDOMWindow.h"
#include "nsReadableUtils.h"
#include "nsServiceManagerUtils.h"
#include "nsThreadUtils.h"

namespace zen {

ZenGlobalShortcuts* ZenGlobalShortcuts::sInstance = nullptr;

NS_IMPL_ISUPPORTS(ZenGlobalShortcuts, nsIZenGlobalShortcuts)

ZenGlobalShortcuts::ZenGlobalShortcuts() {
  MOZ_ASSERT(NS_IsMainThread());
  MOZ_ASSERT(!sInstance);
  sInstance = this;
}

ZenGlobalShortcuts::~ZenGlobalShortcuts() {
  MOZ_ASSERT(NS_IsMainThread());
  for (auto& reg : mRegistrations) {
    NativeUnregister(reg);
  }
  mRegistrations.Clear();
  NativeShutdown();
  sInstance = nullptr;
}

NS_IMETHODIMP
ZenGlobalShortcuts::RegisterShortcut(const nsACString& aId,
                                     const nsACString& aKey,
                                     uint32_t aModifiers, bool* aRetVal) {
  MOZ_ASSERT(NS_IsMainThread());
  *aRetVal = false;

  for (const auto& reg : mRegistrations) {
    if (reg.id.Equals(aId)) return NS_ERROR_ALREADY_INITIALIZED;
  }

  Registration reg;
  reg.id = aId;
  reg.internalId = mNextInternalId++;

  if (NS_FAILED(NativeRegister(reg, aKey, aModifiers))) {
    return NS_OK;
  }

  mRegistrations.AppendElement(std::move(reg));
  *aRetVal = true;
  return NS_OK;
}

NS_IMETHODIMP
ZenGlobalShortcuts::UnregisterShortcut(const nsACString& aId) {
  MOZ_ASSERT(NS_IsMainThread());
  for (size_t i = 0; i < mRegistrations.Length(); ++i) {
    if (mRegistrations[i].id.Equals(aId)) {
      NativeUnregister(mRegistrations[i]);
      mRegistrations.RemoveElementAt(i);
      return NS_OK;
    }
  }
  return NS_OK;
}

NS_IMETHODIMP
ZenGlobalShortcuts::UnregisterAll() {
  MOZ_ASSERT(NS_IsMainThread());
  for (auto& reg : mRegistrations) {
    NativeUnregister(reg);
  }
  mRegistrations.Clear();
  return NS_OK;
}

const ZenGlobalShortcuts::Registration* ZenGlobalShortcuts::FindByInternalId(
    uint32_t aInternalId) const {
  for (const auto& reg : mRegistrations) {
    if (reg.internalId == aInternalId) return &reg;
  }
  return nullptr;
}

// static
void ZenGlobalShortcuts::OnNativeShortcut(uint32_t aInternalId) {
  if (!NS_IsMainThread()) {
    NS_DispatchToMainThread(NS_NewRunnableFunction(
        "ZenGlobalShortcuts::OnNativeShortcut",
        [aInternalId]() { OnNativeShortcut(aInternalId); }));
    return;
  }
  if (!sInstance) return;

  const Registration* reg = sInstance->FindByInternalId(aInternalId);
  if (!reg) return;
  DispatchEventForId(reg->id);
}

// static
void ZenGlobalShortcuts::DispatchEventForId(const nsACString& aId) {
  MOZ_ASSERT(NS_IsMainThread());

  nsCOMPtr<nsIWindowMediator> med = do_GetService(NS_WINDOWMEDIATOR_CONTRACTID);
  if (!med) return;

  nsCOMPtr<mozIDOMWindowProxy> mostRecent;
  med->GetMostRecentBrowserWindow(getter_AddRefs(mostRecent));
  if (!mostRecent) return;

  nsCOMPtr<nsPIDOMWindowOuter> outer = nsPIDOMWindowOuter::From(mostRecent);
  if (!outer) return;

  RefPtr<mozilla::dom::Document> doc = outer->GetExtantDoc();
  if (!doc) return;

  nsAutoString eventName;
  eventName.AssignLiteral(u"zen-global-shortcut-");
  AppendUTF8toUTF16(aId, eventName);

  nsContentUtils::DispatchTrustedEvent(doc, nsGlobalWindowOuter::Cast(outer),
                                       eventName, mozilla::CanBubble::eYes,
                                       mozilla::Cancelable::eNo);
}

}  // namespace zen
