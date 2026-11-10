/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <cmath>
#include <limits>

#include "nsZenBoostData.h"
#include "nsZenBoostsStyle.h"

#include "nsIURI.h"
#include "nsJSUtils.h"

#include "js/Array.h"
#include "js/Conversions.h"
#include "js/PropertyAndElement.h"
#include "js/RootingAPI.h"
#include "js/Value.h"

namespace zen {

namespace {

static bool ReadBool(JSContext* aCx, JS::Handle<JSObject*> aObject,
                     const char* aName, bool* aResult) {
  JS::Rooted<JS::Value> value(aCx);
  if (!JS_GetProperty(aCx, aObject, aName, &value)) {
    return false;
  }
  *aResult = JS::ToBoolean(value);
  return true;
}

static bool ReadFloat(JSContext* aCx, JS::Handle<JSObject*> aObject,
                      const char* aName, float* aResult) {
  JS::Rooted<JS::Value> value(aCx);
  if (!JS_GetProperty(aCx, aObject, aName, &value)) {
    return false;
  }
  if (!value.isNumber()) {
    return true;
  }
  const double number = value.toNumber();
  if (std::abs(number) <= double(std::numeric_limits<float>::max())) {
    *aResult = static_cast<float>(number);
  }
  return true;
}

static bool AppendString(JSContext* aCx, JS::Handle<JS::Value> aValue,
                         nsACString& aResult) {
  nsAutoJSString string;
  if (!string.init(aCx, aValue.toString())) {
    return false;
  }
  AppendUTF16toUTF8(string, aResult);
  return true;
}

static bool ReadString(JSContext* aCx, JS::Handle<JSObject*> aObject,
                       const char* aName, nsACString& aResult) {
  JS::Rooted<JS::Value> value(aCx);
  if (!JS_GetProperty(aCx, aObject, aName, &value)) {
    return false;
  }
  return !value.isString() || AppendString(aCx, value, aResult);
}

static bool ReadStringArray(JSContext* aCx, JS::Handle<JSObject*> aObject,
                            const char* aName, nsTArray<nsCString>& aResult) {
  JS::Rooted<JS::Value> value(aCx);
  if (!JS_GetProperty(aCx, aObject, aName, &value)) {
    return false;
  }
  bool isArray = false;
  if (!JS::IsArrayObject(aCx, value, &isArray)) {
    return false;
  }
  if (!isArray) {
    return true;
  }
  JS::Rooted<JSObject*> array(aCx, &value.toObject());
  uint32_t length = 0;
  if (!JS::GetArrayLength(aCx, array, &length)) {
    return false;
  }
  JS::Rooted<JS::Value> element(aCx);
  for (uint32_t i = 0; i < length; ++i) {
    if (!JS_GetElement(aCx, array, i, &element)) {
      return false;
    }
    if (!element.isString()) {
      continue;
    }
    nsCString string;
    if (!AppendString(aCx, element, string)) {
      return false;
    }
    if (!string.IsEmpty()) {
      aResult.AppendElement(std::move(string));
    }
  }
  return true;
}

}  // namespace

bool ReadBoostData(JSContext* aCx, JS::Handle<JS::Value> aBoostData,
                   nsZenBoost& aBoost) {
  JS::Rooted<JSObject*> data(aCx, &aBoostData.toObject());
  nsZenBoostStyle style;
  if (!ReadBool(aCx, data, "enableColorBoost", &aBoost.colorEnabled) ||
      !ReadBool(aCx, data, "autoTheme", &aBoost.autoTheme) ||
      !ReadBool(aCx, data, "smartInvert", &aBoost.smartInvert) ||
      !ReadFloat(aCx, data, "dotAngleDeg", &aBoost.hueDeg) ||
      !ReadFloat(aCx, data, "saturation", &aBoost.saturation) ||
      !ReadFloat(aCx, data, "brightness", &aBoost.brightness) ||
      !ReadFloat(aCx, data, "contrast", &aBoost.contrast) ||
      !ReadFloat(aCx, data, "secondaryDotAngleDegDelta",
                 &aBoost.complementaryRotation) ||
      !ReadString(aCx, data, "fontFamily", style.fontFamily) ||
      !ReadString(aCx, data, "textCaseOverride", style.textTransform) ||
      !ReadStringArray(aCx, data, "zapSelectors", style.zapSelectors) ||
      !ReadStringArray(aCx, data, "focusSelectors", style.focusSelectors) ||
      !ReadString(aCx, data, "customCSS", style.customCSS)) {
    return false;
  }
  aBoost.styleSheet = detail::BuildStyleSheetURI(style);
  return true;
}

void GetBoostHost(nsIURI* aURI, nsACString& aHost) {
  aHost.Truncate();
  if (aURI && NS_FAILED(aURI->GetAsciiHost(aHost))) {
    aHost.Truncate();
  }
}

}  // namespace zen
