/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenBlockedShortcuts.h"

#include "mozilla/EventDispatcher.h"
#include "mozilla/GlobalKeyListener.h"
#include "mozilla/KeyEventHandler.h"
#include "mozilla/RefPtr.h"
#include "mozilla/StaticPrefs_zen.h"
#include "mozilla/TextEvents.h"
#include "mozilla/dom/Document.h"
#include "mozilla/dom/DocumentInlines.h"
#include "mozilla/dom/Element.h"
#include "mozilla/dom/KeyboardEvent.h"
#include "nsContentUtils.h"
#include "nsGkAtoms.h"
#include "nsPresContext.h"

using namespace mozilla;
using namespace mozilla::dom;

namespace zen {

static void GetConflict(Element* aKey, nsAString& aConflict) {
  aKey->GetAttribute(u"zen-website-conflict"_ns, aConflict);
  if (aConflict.IsEmpty()) {
    aKey->GetAttribute(u"zen-website-conflict-default"_ns, aConflict);
  }
}

bool ZenBlockedShortcuts::IsOverridable(const WidgetKeyboardEvent& aEvent) {
  if (!StaticPrefs::zen_keyboard_shortcuts_override_page_shortcuts()) {
    return false;
  }
  if (aEvent.mMessage != eKeyDown && aEvent.mMessage != eKeyPress) {
    return false;
  }
  if (!aEvent.IsTrusted() || aEvent.mIsRepeat) {
    return false;
  }
  return aEvent.IsControl() || aEvent.IsAlt() || aEvent.IsMeta();
}

void ZenBlockedShortcuts::OnKeyEventPreventedByContent(
    GlobalKeyListener* aListener, KeyboardEvent* aKeyEvent) {
  WidgetKeyboardEvent* widgetEvent =
      aKeyEvent->WidgetEventPtr()->AsKeyboardEvent();
  if (!widgetEvent || !widgetEvent->IsHandledInRemoteProcess() ||
      !widgetEvent->DefaultPreventedByContent() ||
      widgetEvent->mFlags.mMultipleActionsPrevented ||
      !IsOverridable(*widgetEvent)) {
    return;
  }

  RefPtr<Element> key = FindKey(aListener, aKeyEvent);
  if (!key) {
    return;
  }
  nsAutoString conflict;
  GetConflict(key, conflict);
  if (conflict.EqualsLiteral("website")) {
    return;
  }
  widgetEvent->mFlags.mMultipleActionsPrevented = true;

  RefPtr<Document> doc = key->OwnerDoc();
  bool defaultAction = true;
  nsContentUtils::DispatchEventOnlyToChrome(doc, key, u"ZenShortcutBlocked"_ns,
                                            CanBubble::eYes, Cancelable::eYes,
                                            &defaultAction);
  if (defaultAction || !key->IsInComposedDoc() ||
      key->GetBoolAttr(nsGkAtoms::disabled)) {
    return;
  }

  // Same as KeyEventHandler::DispatchXULKeyCommand.
  nsContentUtils::DispatchXULCommand(
      key, true, nullptr, nullptr, aKeyEvent->CtrlKey(), aKeyEvent->AltKey(),
      aKeyEvent->ShiftKey(), aKeyEvent->MetaKey());
}

void ZenBlockedShortcuts::OnKeyPressSuppressedByContent(
    Element* aFrameElement, const WidgetKeyboardEvent& aEvent) {
  if (!aFrameElement || aEvent.mMessage != eKeyPress ||
      !IsOverridable(aEvent)) {
    return;
  }
  RefPtr<nsPresContext> presContext =
      aFrameElement->OwnerDoc()->GetPresContext();
  if (!presContext) {
    return;
  }

  WidgetKeyboardEvent localEvent(aEvent);
  localEvent.mFlags.mPropagationStopped = false;
  localEvent.mFlags.mImmediatePropagationStopped = false;
  localEvent.MarkAsHandledInRemoteProcess();
  localEvent.mFlags.mOnlySystemGroupDispatch = true;
  localEvent.PreventDefault(false);

  AutoHandlingUserInputStatePusher userInputStatePusher(true, &localEvent);
  RefPtr<Element> frameElement = aFrameElement;
  nsEventStatus status = nsEventStatus_eIgnore;
  EventDispatcher::Dispatch(frameElement, presContext, &localEvent, nullptr,
                            &status);
}

bool ZenBlockedShortcuts::IsPreferredByZen(KeyEventHandler* aHandler) {
  if (!StaticPrefs::zen_keyboard_shortcuts_override_page_shortcuts()) {
    return false;
  }
  RefPtr<Element> key = aHandler->GetHandlerElement();
  if (!key) {
    return false;
  }
  nsAutoString conflict;
  GetConflict(key, conflict);
  return conflict.EqualsLiteral("zen");
}

already_AddRefed<Element> ZenBlockedShortcuts::FindKey(
    GlobalKeyListener* aListener, KeyboardEvent* aKeyEvent) {
  KeyEventHandler* handler = aListener->HasHandlerForEvent(aKeyEvent).mHandler;
  if (!handler || !aListener->CanHandle(handler, true)) {
    return nullptr;
  }
  return handler->GetHandlerElement();
}

}  // namespace zen
