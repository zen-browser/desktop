/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "ZenWindowControl.h"

#include "WidgetUtils.h"
#include "nsCOMPtr.h"
#include "nsIWidget.h"
#include "nsPIDOMWindow.h"

namespace zen {

NS_IMPL_ISUPPORTS(ZenWindowControl, nsIZenWindowControl)

namespace {

static nsCOMPtr<nsIWidget> WidgetFor(mozIDOMWindowProxy* aWindow) {
  if (!aWindow) return nullptr;
  nsPIDOMWindowOuter* outer = nsPIDOMWindowOuter::From(aWindow);
  if (!outer) return nullptr;
  return mozilla::widget::WidgetUtils::DOMWindowToWidget(outer);
}

}  // namespace

NS_IMETHODIMP
ZenWindowControl::Hide(mozIDOMWindowProxy* aWindow) {
  nsCOMPtr<nsIWidget> widget = WidgetFor(aWindow);
  if (!widget) return NS_ERROR_FAILURE;
  // Hide first, then arm the lock so any subsequent Show(true) called
  // from anywhere in the tree is rejected by the widget itself.
  widget->Show(false);
  widget->SetZenShowLocked(true);
  return NS_OK;
}

NS_IMETHODIMP
ZenWindowControl::Show(mozIDOMWindowProxy* aWindow) {
  nsCOMPtr<nsIWidget> widget = WidgetFor(aWindow);
  if (!widget) return NS_ERROR_FAILURE;
  widget->SetZenShowLocked(false);
  widget->Show(true);
  return NS_OK;
}

}  // namespace zen
