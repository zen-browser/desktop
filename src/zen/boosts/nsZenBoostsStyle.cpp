/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <algorithm>
#include <cmath>

#include "nsZenBoostsStyle.h"

#include "mozilla/Base64.h"

namespace zen::detail {

namespace {

constexpr auto kStyleSheetDataPrefix = "data:text/css;charset=utf-8;base64,"_ns;

constexpr auto kFocusRules = R"CSS( {
  width: fit-content !important;
  max-width: 70vw !important;
  width: 100% !important;

  html:has(&) {
    overflow: auto !important;
    height: auto !important;

    body {
      display: flex !important;
      flex-direction: column !important;
      align-items: safe center !important;
      justify-content: safe center !important;
      box-sizing: border-box !important;
      min-height: 100vh !important;
      height: auto !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 48px 0 !important;
    }
  }

  html:has(&) body *:has(&) {
    display: contents !important;
  }

  html:has(&) body *:not(&, & *, :has(&)) {
    display: none !important;
  }
}

)CSS"_ns;

/**
 * @brief Helper of HslToRgb, resolving one channel.
 */
static float HueToChannel(float aP, float aQ, float aT) {
  if (aT < 0.0f) {
    aT += 1.0f;
  }
  if (aT > 1.0f) {
    aT -= 1.0f;
  }
  if (aT < 1.0f / 6.0f) {
    return aP + (aQ - aP) * 6.0f * aT;
  }
  if (aT < 1.0f / 2.0f) {
    return aQ;
  }
  if (aT < 2.0f / 3.0f) {
    return aP + (aQ - aP) * (2.0f / 3.0f - aT) * 6.0f;
  }
  return aP;
}

static uint8_t UnitToByte(float aValue) {
  return static_cast<uint8_t>(
      std::clamp(std::floor(aValue * 255.0f + 0.5f), 0.0f, 255.0f));
}

/**
 * @brief Converts an HSL color to an opaque nscolor.
 * @param aHue The hue, in turns.
 * @param aSaturation The saturation in [0, 1].
 * @param aLightness The lightness in [0, 1].
 */
static nscolor HslToRgb(float aHue, float aSaturation, float aLightness) {
  if (aSaturation == 0.0f) {
    const uint8_t gray = UnitToByte(aLightness);
    return NS_RGB(gray, gray, gray);
  }
  const float q = aLightness < 0.5f
                      ? aLightness * (1.0f + aSaturation)
                      : aLightness + aSaturation - aLightness * aSaturation;
  const float p = 2.0f * aLightness - q;
  return NS_RGB(UnitToByte(HueToChannel(p, q, aHue + 1.0f / 3.0f)),
                UnitToByte(HueToChannel(p, q, aHue)),
                UnitToByte(HueToChannel(p, q, aHue - 1.0f / 3.0f)));
}

static bool HasNonWhitespace(const nsACString& aString) {
  for (const char* c = aString.BeginReading(); c != aString.EndReading(); ++c) {
    if (*c != ' ' && *c != '\t' && *c != '\n' && *c != '\r' && *c != '\f') {
      return true;
    }
  }
  return false;
}

}  // namespace

nscolor BuildAccentColor(float aHueDeg, const nsZenBoost& aBoost) {
  const nscolor rgb = HslToRgb(aHueDeg / 360.0f, 1.0f - aBoost.saturation,
                               0.1f + 0.9f * aBoost.brightness);
  const auto strength = static_cast<uint8_t>(
      std::clamp((1.0f - aBoost.contrast) * 255.0f, 0.0f, 255.0f));
  return NS_RGBA(NS_GET_R(rgb), NS_GET_G(rgb), NS_GET_B(rgb), strength);
}

float HueOfColor(nscolor aColor) {
  const float r = NS_GET_R(aColor) / 255.0f;
  const float g = NS_GET_G(aColor) / 255.0f;
  const float b = NS_GET_B(aColor) / 255.0f;
  const float max = std::max({r, g, b});
  const float delta = max - std::min({r, g, b});
  if (delta == 0.0f) {
    return 0.0f;
  }
  float sextant;
  if (max == r) {
    sextant = std::fmod((g - b) / delta, 6.0f);
  } else if (max == g) {
    sextant = (b - r) / delta + 2.0f;
  } else {
    sextant = (r - g) / delta + 4.0f;
  }
  return sextant * 60.0f;
}

nsCString BuildStyleRules(const nsZenBoostStyle& aStyle) {
  nsCString css;

  if (!aStyle.zapSelectors.IsEmpty()) {
    css.AppendLiteral("/* Zen-Zaps */\n");
    for (const nsCString& selector : aStyle.zapSelectors) {
      css.Append(selector);
      css.AppendLiteral(
          ":not([zen-zap-unhide]){ display: none !important; }\n");
    }
    css.Append('\n');
  }

  if (!aStyle.focusSelectors.IsEmpty()) {
    css.AppendLiteral("/* Zen-Focus */\n:is(");
    bool first = true;
    for (const nsCString& selector : aStyle.focusSelectors) {
      if (!first) {
        css.AppendLiteral(", ");
      }
      first = false;
      css.Append(selector);
    }
    css.Append(')');
    css.Append(kFocusRules);
  }

  const bool hasFontFamily = !aStyle.fontFamily.IsEmpty();
  const bool hasTextTransform = !aStyle.textTransform.IsEmpty() &&
                                !aStyle.textTransform.EqualsLiteral("none");
  if (hasFontFamily || hasTextTransform) {
    css.AppendLiteral(
        "/* Text Format */\n"
        "body *:not(.google-symbols, gf-load-icon-font, mat-icon, "
        ".google-material-icons) {\n");
    if (hasFontFamily) {
      css.AppendLiteral("font-family: ");
      css.Append(aStyle.fontFamily);
      css.AppendLiteral(" !important;\n");
    }
    if (hasTextTransform) {
      css.AppendLiteral("text-transform: ");
      css.Append(aStyle.textTransform);
      css.AppendLiteral(" !important;\n");
    }
    css.AppendLiteral("}\n");
  }

  if (HasNonWhitespace(aStyle.customCSS)) {
    css.AppendLiteral("/* USER CSS */\n");
    css.Append(aStyle.customCSS);
    css.Append('\n');
  }

  return css;
}

nsCString BuildStyleSheetURI(const nsZenBoostStyle& aStyle) {
  const nsCString rules = BuildStyleRules(aStyle);
  nsCString spec;
  if (rules.IsEmpty()) {
    return spec;
  }
  nsAutoCString encoded;
  if (NS_FAILED(mozilla::Base64Encode(rules, encoded))) {
    return spec;
  }
  spec.Append(kStyleSheetDataPrefix);
  spec.Append(encoded);
  return spec;
}

}  // namespace zen::detail
