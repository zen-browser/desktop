/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenGlobalShortcuts.h"

#include <utility>

#include "mozilla/Assertions.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/EventForwards.h"
#include "mozilla/KeyEventHandler.h"
#include "mozilla/Preferences.h"
#include "mozilla/RefPtr.h"
#include "mozilla/StaticPrefs_zen.h"
#include "mozilla/StaticPtr.h"
#include "mozilla/WidgetUtils.h"
#include "mozilla/dom/Document.h"
#include "mozilla/dom/Element.h"
#include "nsCOMPtr.h"
#include "nsContentUtils.h"
#include "nsFocusManager.h"
#include "nsGkAtoms.h"
#include "nsIWeakReferenceUtils.h"
#include "nsPIDOMWindow.h"
#include "nsString.h"
#include "nsTArray.h"
#include "nsThreadUtils.h"
#include "nsXULAppAPI.h"

using namespace mozilla;
using namespace mozilla::dom;

namespace zen {

namespace {

constexpr auto kEnabledPref = "zen.keyboard.global-shortcuts.enabled"_ns;

// A <key global="true"> of a keyset that is being listened for.
struct GlobalKey {
  nsWeakPtr mKey;
  nsWeakPtr mKeyset;
  uint32_t mKeyCode;
  Modifiers mModifiers;
};

// A combination registered with the system. Any number of keys, one in each
// window, can stand behind it.
struct HotKey {
  uint32_t mId;
  uint32_t mKeyCode;
  Modifiers mModifiers;
  // Whatever the platform needs to give the combination back.
  void* mNativeHotKey;
};

StaticAutoPtr<nsTArray<GlobalKey>> sKeys;
StaticAutoPtr<nsTArray<HotKey>> sHotKeys;
// Keysets that were reported and have not been read yet.
StaticAutoPtr<nsTArray<nsWeakPtr>> sPendingKeysets;
uint32_t sNextHotKeyId = 1;

bool IsGlobalKey(nsIContent* aContent) {
  if (!aContent->NodeInfo()->Equals(nsGkAtoms::key, kNameSpaceID_XUL)) {
    return false;
  }
  nsAutoString global;
  aContent->AsElement()->GetAttribute(u"global"_ns, global);
  return global.EqualsLiteral("true");
}

already_AddRefed<Element> LiveKey(const GlobalKey& aKey) {
  nsCOMPtr<Element> key = do_QueryReferent(aKey.mKey);
  if (!key || !key->IsInComposedDoc()) {
    return nullptr;
  }
  Document* doc = key->OwnerDoc();
  nsPIDOMWindowOuter* window = doc->GetWindow();
  if (!doc->GetDocShell() || !window || window->Closed()) {
    return nullptr;
  }
  return key.forget();
}

// Whether pressing the key would do anything in its window right now.
bool IsExecutable(Element* aKey) {
  if (aKey->GetBoolAttr(nsGkAtoms::disabled)) {
    return false;
  }
  nsAutoString command;
  aKey->GetAttr(nsGkAtoms::command, command);
  if (command.IsEmpty()) {
    return true;
  }
  Element* commandElement = aKey->OwnerDoc()->GetElementById(command);
  return commandElement && !commandElement->GetBoolAttr(nsGkAtoms::disabled);
}

}  // namespace

/* static */
bool ZenGlobalShortcuts::BindingOf(Element* aKey, uint32_t* aKeyCode,
                                   Modifiers* aModifiers) {
  KeyEventHandler handler(aKey, ReservedKey_Unset);
  if (handler.mDetail <= 0) {
    return false;
  }
  uint32_t keyCode = handler.mMisc
                         ? widget::WidgetUtils::ComputeKeyCodeFromChar(
                               static_cast<uint32_t>(handler.mDetail))
                         : static_cast<uint32_t>(handler.mDetail);
  Modifiers modifiers = handler.GetModifiers();
  // A plain or shifted key would stop that key from being typed anywhere.
  if (!keyCode ||
      !(modifiers & (MODIFIER_CONTROL | MODIFIER_ALT | MODIFIER_META))) {
    return false;
  }
  *aKeyCode = keyCode;
  *aModifiers = modifiers;
  return true;
}

/* static */
void ZenGlobalShortcuts::AttachKeyset(Element* aKeyset) {
  MOZ_ASSERT(NS_IsMainThread());
  if (!XRE_IsParentProcess() ||
      !nsContentUtils::IsChromeDoc(aKeyset->OwnerDoc())) {
    return;
  }
  if (!sKeys) {
    sKeys = new nsTArray<GlobalKey>();
    sHotKeys = new nsTArray<HotKey>();
    sPendingKeysets = new nsTArray<nsWeakPtr>();
    Preferences::RegisterCallback(OnPrefChanged, kEnabledPref);
    RunOnShutdown([] {
      Preferences::UnregisterCallback(OnPrefChanged, kEnabledPref);
      for (const HotKey& hotKey : *sHotKeys) {
        PlatformUnregister(hotKey.mId, hotKey.mNativeHotKey);
      }
      PlatformShutdown();
      sKeys = nullptr;
      sHotKeys = nullptr;
      sPendingKeysets = nullptr;
    });
  }
  bool isScheduled = !sPendingKeysets->IsEmpty();
  sPendingKeysets->AppendElement(do_GetWeakReference(aKeyset));
  if (!isScheduled) {
    NS_DispatchToMainThread(
        NS_NewRunnableFunction("ZenGlobalShortcuts::ReadPendingKeysets",
                               [] { ReadPendingKeysets(); }));
  }
}

/* static */
void ZenGlobalShortcuts::ReadPendingKeysets() {
  if (!sKeys || !sPendingKeysets) {
    return;
  }
  nsTArray<nsWeakPtr> pending = std::move(*sPendingKeysets);
  sPendingKeysets->Clear();
  for (const nsWeakPtr& weakKeyset : pending) {
    nsCOMPtr<Element> keyset = do_QueryReferent(weakKeyset);
    if (!keyset || !keyset->IsInComposedDoc()) {
      continue;
    }
    sKeys->RemoveElementsBy(
        [&](const GlobalKey& aKey) { return aKey.mKeyset == weakKeyset; });
    for (nsIContent* child = keyset->GetFirstChild(); child;
         child = child->GetNextSibling()) {
      if (!IsGlobalKey(child)) {
        continue;
      }
      uint32_t keyCode = 0;
      Modifiers modifiers = MODIFIER_NONE;
      if (!IsExecutable(child->AsElement()) ||
          !BindingOf(child->AsElement(), &keyCode, &modifiers)) {
        continue;
      }
      sKeys->AppendElement(GlobalKey{do_GetWeakReference(child->AsElement()),
                                     weakKeyset, keyCode, modifiers});
    }
  }
  Sync();
}

/* static */
void ZenGlobalShortcuts::DetachKeyset(Element* aKeyset) {
  MOZ_ASSERT(NS_IsMainThread());
  if (!sKeys) {
    return;
  }
  nsWeakPtr keyset = do_GetWeakReference(aKeyset);
  size_t before = sKeys->Length();
  sKeys->RemoveElementsBy(
      [&](const GlobalKey& aKey) { return aKey.mKeyset == keyset; });
  if (sKeys->Length() != before) {
    Sync();
  }
}

/* static */
void ZenGlobalShortcuts::Sync() {
  if (!sKeys || !sHotKeys) {
    return;
  }
  sKeys->RemoveElementsBy([](const GlobalKey& aKey) {
    RefPtr<Element> key = LiveKey(aKey);
    return !key;
  });

  bool enabled = StaticPrefs::zen_keyboard_global_shortcuts_enabled();
  auto isWanted = [&](uint32_t aKeyCode, Modifiers aModifiers) {
    if (!enabled) {
      return false;
    }
    for (const GlobalKey& key : *sKeys) {
      if (key.mKeyCode == aKeyCode && key.mModifiers == aModifiers) {
        return true;
      }
    }
    return false;
  };
  sHotKeys->RemoveElementsBy([&](const HotKey& aHotKey) {
    if (isWanted(aHotKey.mKeyCode, aHotKey.mModifiers)) {
      return false;
    }
    PlatformUnregister(aHotKey.mId, aHotKey.mNativeHotKey);
    return true;
  });
  if (!enabled) {
    return;
  }

  for (const GlobalKey& key : *sKeys) {
    bool isRegistered = false;
    for (const HotKey& hotKey : *sHotKeys) {
      if (hotKey.mKeyCode == key.mKeyCode &&
          hotKey.mModifiers == key.mModifiers) {
        isRegistered = true;
        break;
      }
    }
    if (isRegistered) {
      continue;
    }
    uint32_t id = sNextHotKeyId++;
    void* nativeHotKey = nullptr;
    if (PlatformRegister(id, key.mKeyCode, key.mModifiers, &nativeHotKey)) {
      sHotKeys->AppendElement(
          HotKey{id, key.mKeyCode, key.mModifiers, nativeHotKey});
    }
  }
}

/* static */
void ZenGlobalShortcuts::OnPrefChanged(const char* aPref, void* aData) {
  Sync();
}

/* static */
void ZenGlobalShortcuts::OnHotKey(uint32_t aHotKeyId) {
  MOZ_ASSERT(NS_IsMainThread());
  NS_DispatchToMainThread(NS_NewRunnableFunction(
      "ZenGlobalShortcuts::OnHotKey", [aHotKeyId] { Fire(aHotKeyId); }));
}

/* static */
void ZenGlobalShortcuts::Fire(uint32_t aHotKeyId) {
  if (!sKeys || !sHotKeys) {
    return;
  }
  uint32_t keyCode = 0;
  Modifiers modifiers = MODIFIER_NONE;
  for (const HotKey& hotKey : *sHotKeys) {
    if (hotKey.mId == aHotKeyId) {
      keyCode = hotKey.mKeyCode;
      modifiers = hotKey.mModifiers;
      break;
    }
  }
  if (!keyCode) {
    return;
  }

  nsFocusManager* focusManager = nsFocusManager::GetFocusManager();
  nsPIDOMWindowOuter* activeWindow =
      focusManager ? focusManager->GetActiveWindow() : nullptr;
  RefPtr<Element> target;
  for (const GlobalKey& key : *sKeys) {
    if (key.mKeyCode != keyCode || key.mModifiers != modifiers) {
      continue;
    }
    RefPtr<Element> element = LiveKey(key);
    if (!element || !IsExecutable(element)) {
      continue;
    }
    target = element;
    if (activeWindow && element->OwnerDoc()->GetWindow() == activeWindow) {
      break;
    }
  }
  if (!target) {
    sKeys->RemoveElementsBy([&](const GlobalKey& aKey) {
      return aKey.mKeyCode == keyCode && aKey.mModifiers == modifiers;
    });
    Sync();
    return;
  }
  PlatformWillRunKey();
  nsContentUtils::DispatchXULCommand(
      target, true, nullptr, nullptr, !!(modifiers & MODIFIER_CONTROL),
      !!(modifiers & MODIFIER_ALT), !!(modifiers & MODIFIER_SHIFT),
      !!(modifiers & MODIFIER_META));
}

}  // namespace zen
