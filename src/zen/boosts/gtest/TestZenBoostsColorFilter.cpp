/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gtest/gtest.h"

#include "mozilla/nsZenBoostsBackend.h"

using zen::detail::FilterColorChannel;
using zen::detail::InvertColorChannel;
using zen::detail::PrecomputeAccent;
using zen::detail::RotateAccent;

namespace {

// A spread of representative input colors (opaque unless noted).
const nscolor kColors[] = {
    NS_RGBA(255, 0, 0, 255),      // pure red
    NS_RGBA(0, 255, 0, 255),      // pure green
    NS_RGBA(0, 0, 255, 255),      // pure blue
    NS_RGBA(0, 0, 0, 255),        // black
    NS_RGBA(255, 255, 255, 255),  // white
    NS_RGBA(128, 128, 128, 255),  // mid gray
    NS_RGBA(18, 52, 86, 200),     // arbitrary, semi-transparent
    NS_RGBA(240, 17, 99, 1),      // near-min alpha
};

// The accent stores the contrast/strength in its alpha byte
// (NS_GET_CONTRAST == NS_GET_A). 0 means "no tint".
zen::nsZenAccentOklab MakeAccent(uint8_t r, uint8_t g, uint8_t b,
                                 uint8_t contrast) {
  return PrecomputeAccent(NS_RGBA(r, g, b, contrast));
}

}  // namespace

// The headline invariant: filtering must never change opacity. The whole
// pipeline overloads the alpha byte for contrast on the *accent*, but a
// filtered *content* color must keep its original alpha.
TEST(ZenBoostsColorFilter, PreservesAlpha)
{
  const zen::nsZenAccentOklab accent = MakeAccent(80, 120, 200, 180);
  const zen::nsZenAccentOklab complementary = RotateAccent(accent, 180.0f);

  for (nscolor c : kColors) {
    const nscolor out = FilterColorChannel(c, accent, complementary);
    EXPECT_EQ(NS_GET_A(out), NS_GET_A(c)) << "alpha changed for input " << c;
  }
}

// Fully transparent colors are invisible; the filter must pass them through
// untouched (and must not interpret their zero alpha as contrast).
TEST(ZenBoostsColorFilter, TransparentPassthrough)
{
  const zen::nsZenAccentOklab accent = MakeAccent(80, 120, 200, 180);
  const zen::nsZenAccentOklab complementary = RotateAccent(accent, 90.0f);

  const nscolor transparent = NS_RGBA(255, 0, 0, 0);
  EXPECT_EQ(FilterColorChannel(transparent, accent, complementary),
            transparent);
  EXPECT_EQ(InvertColorChannel(transparent), transparent);
}

// Same inputs must always yield the same output (no hidden global state in
// the math itself; the production cache lives outside these primitives).
TEST(ZenBoostsColorFilter, Deterministic)
{
  const zen::nsZenAccentOklab accent = MakeAccent(33, 200, 90, 200);
  const zen::nsZenAccentOklab complementary = RotateAccent(accent, 200.0f);

  for (nscolor c : kColors) {
    const nscolor a = FilterColorChannel(c, accent, complementary);
    const nscolor b = FilterColorChannel(c, accent, complementary);
    EXPECT_EQ(a, b);
    EXPECT_EQ(InvertColorChannel(c), InvertColorChannel(c));
  }
}

// A zero-contrast accent means "no boost strength": the color must come back
// essentially unchanged (allow +/-1 per channel for sRGB<->Oklab rounding).
TEST(ZenBoostsColorFilter, ZeroContrastIsNearIdentity)
{
  const zen::nsZenAccentOklab accent = MakeAccent(200, 50, 50, 0);
  const zen::nsZenAccentOklab complementary = RotateAccent(accent, 180.0f);

  for (nscolor c : kColors) {
    if (NS_GET_A(c) == 0) {
      continue;
    }
    const nscolor out = FilterColorChannel(c, accent, complementary);
    EXPECT_NEAR(NS_GET_R(out), NS_GET_R(c), 1);
    EXPECT_NEAR(NS_GET_G(out), NS_GET_G(c), 1);
    EXPECT_NEAR(NS_GET_B(out), NS_GET_B(c), 1);
    EXPECT_EQ(NS_GET_A(out), NS_GET_A(c));
  }
}

// Guards against a regression that turns the filter into a no-op: a strong
// accent applied to a neutral gray must actually move the color.
TEST(ZenBoostsColorFilter, StrongAccentActuallyTints)
{
  const zen::nsZenAccentOklab accent = MakeAccent(20, 130, 240, 255);
  const zen::nsZenAccentOklab complementary = RotateAccent(accent, 30.0f);

  const nscolor gray = NS_RGBA(128, 128, 128, 255);
  const nscolor out = FilterColorChannel(gray, accent, complementary);

  const bool moved = NS_GET_R(out) != NS_GET_R(gray) ||
                     NS_GET_G(out) != NS_GET_G(gray) ||
                     NS_GET_B(out) != NS_GET_B(gray);
  EXPECT_TRUE(moved) << "a full-strength accent should tint mid gray";
  EXPECT_EQ(NS_GET_A(out), NS_GET_A(gray));
}

// Inversion must also preserve opacity.
TEST(ZenBoostsColorFilter, InvertPreservesAlpha)
{
  for (nscolor c : kColors) {
    EXPECT_EQ(NS_GET_A(InvertColorChannel(c)), NS_GET_A(c));
  }
}
