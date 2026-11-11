/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gtest/gtest.h"

#include "mozilla/nsZenBoostsStyle.h"

using zen::nsZenBoost;
using zen::nsZenBoostStyle;
using zen::detail::BuildAccentColor;
using zen::detail::BuildStyleRules;
using zen::detail::HueOfColor;

TEST(ZenBoostsStyle, AccentPacksColorAndStrength)
{
  nsZenBoost boost;
  boost.saturation = 0.0f;
  boost.brightness = 4.0f / 9.0f;
  boost.contrast = 0.75f;
  EXPECT_EQ(BuildAccentColor(0.0f, boost), NS_RGBA(255, 0, 0, 63));
  EXPECT_EQ(BuildAccentColor(120.0f, boost), NS_RGBA(0, 255, 0, 63));
  EXPECT_EQ(BuildAccentColor(240.0f, boost), NS_RGBA(0, 0, 255, 63));
}

TEST(ZenBoostsStyle, DesaturatedAccentIsGray)
{
  nsZenBoost boost;
  boost.saturation = 1.0f;
  boost.brightness = 1.0f;
  boost.contrast = 0.0f;
  EXPECT_EQ(BuildAccentColor(200.0f, boost), NS_RGBA(255, 255, 255, 255));
}

TEST(ZenBoostsStyle, HueOfColor)
{
  EXPECT_FLOAT_EQ(HueOfColor(NS_RGB(255, 0, 0)), 0.0f);
  EXPECT_FLOAT_EQ(HueOfColor(NS_RGB(0, 255, 0)), 120.0f);
  EXPECT_FLOAT_EQ(HueOfColor(NS_RGB(0, 0, 255)), 240.0f);
  EXPECT_FLOAT_EQ(HueOfColor(NS_RGB(128, 128, 128)), 0.0f);
}

TEST(ZenBoostsStyle, NoRulesGivesNoStyleSheet)
{
  nsZenBoostStyle style;
  EXPECT_TRUE(BuildStyleRules(style).IsEmpty());

  style.textTransform.AssignLiteral("none");
  style.customCSS.AssignLiteral(" \n\t ");
  EXPECT_TRUE(BuildStyleRules(style).IsEmpty());
}

TEST(ZenBoostsStyle, ZapsHideUnlessPreviewed)
{
  nsZenBoostStyle style;
  style.zapSelectors.AppendElement("div.ad"_ns);
  style.zapSelectors.AppendElement("#banner"_ns);
  const nsCString css = BuildStyleRules(style);
  EXPECT_NE(
      css.Find("div.ad:not([zen-zap-unhide]){ display: none !important; }"),
      kNotFound);
  EXPECT_NE(
      css.Find("#banner:not([zen-zap-unhide]){ display: none !important; }"),
      kNotFound);
}

TEST(ZenBoostsStyle, FocusSelectorsShareOneList)
{
  nsZenBoostStyle style;
  style.focusSelectors.AppendElement("article"_ns);
  style.focusSelectors.AppendElement("main"_ns);
  EXPECT_NE(BuildStyleRules(style).Find(":is(article, main) {"), kNotFound);
}

TEST(ZenBoostsStyle, TextFormatAndCustomCSS)
{
  nsZenBoostStyle style;
  style.fontFamily.AssignLiteral("Inter");
  style.textTransform.AssignLiteral("uppercase");
  style.customCSS.AssignLiteral("p { color: red; }");
  const nsCString css = BuildStyleRules(style);
  EXPECT_NE(css.Find("font-family: Inter !important;"), kNotFound);
  EXPECT_NE(css.Find("text-transform: uppercase !important;"), kNotFound);
  EXPECT_NE(css.Find("p { color: red; }"), kNotFound);
}
