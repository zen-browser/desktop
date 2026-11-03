/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gtest/gtest.h"

#include "mozilla/nsZenBoostsBackend.h"

using zen::detail::AccentCacheSize;
using zen::detail::EnsureCachedAccent;
using zen::detail::IsAccentCached;
using zen::detail::ResetAccentCache;

namespace {

class ZenBoostsAccentCache : public ::testing::Test {
 protected:
  void SetUp() override { ResetAccentCache(); }
  void TearDown() override { ResetAccentCache(); }
};

constexpr nscolor kAccentA = NS_RGBA(80, 120, 200, 200);
constexpr nscolor kAccentB = NS_RGBA(200, 80, 80, 200);
constexpr nscolor kAccentC = NS_RGBA(80, 200, 120, 200);
constexpr nscolor kAccentD = NS_RGBA(200, 200, 80, 200);
constexpr nscolor kAccentE = NS_RGBA(120, 80, 200, 200);

}  // namespace

TEST_F(ZenBoostsAccentCache, SizeIsAtLeastFour) {
  EXPECT_GE(AccentCacheSize(), 4u);
}

TEST_F(ZenBoostsAccentCache, EmptyAfterReset) {
  EnsureCachedAccent(kAccentA, 0.0f);
  ResetAccentCache();
  EXPECT_FALSE(IsAccentCached(kAccentA, 0.0f));
}

TEST_F(ZenBoostsAccentCache, SameKeyIsCachedAfterEnsure) {
  EXPECT_FALSE(IsAccentCached(kAccentA, 0.0f));
  EnsureCachedAccent(kAccentA, 0.0f);
  EXPECT_TRUE(IsAccentCached(kAccentA, 0.0f));
}

// Keying on accent alone would silently serve a stale complementary accent
// when the rotation changes.
TEST_F(ZenBoostsAccentCache, DifferentRotationOccupiesDistinctEntry) {
  EnsureCachedAccent(kAccentA, 0.0f);
  EnsureCachedAccent(kAccentA, 90.0f);
  EXPECT_TRUE(IsAccentCached(kAccentA, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentA, 90.0f));
}

TEST_F(ZenBoostsAccentCache, DifferentAccentOccupiesDistinctEntry) {
  EnsureCachedAccent(kAccentA, 30.0f);
  EnsureCachedAccent(kAccentB, 30.0f);
  EXPECT_TRUE(IsAccentCached(kAccentA, 30.0f));
  EXPECT_TRUE(IsAccentCached(kAccentB, 30.0f));
}

TEST_F(ZenBoostsAccentCache, RoundRobinEvictsOldestEntry) {
  ASSERT_EQ(AccentCacheSize(), 4u);

  EnsureCachedAccent(kAccentA, 0.0f);
  EnsureCachedAccent(kAccentB, 0.0f);
  EnsureCachedAccent(kAccentC, 0.0f);
  EnsureCachedAccent(kAccentD, 0.0f);

  EXPECT_TRUE(IsAccentCached(kAccentA, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentB, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentC, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentD, 0.0f));

  EnsureCachedAccent(kAccentE, 0.0f);
  EXPECT_FALSE(IsAccentCached(kAccentA, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentB, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentC, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentD, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentE, 0.0f));
}

// A cache hit must not consume a fresh slot, otherwise repeated paints with
// the same accent would evict their own neighbours.
TEST_F(ZenBoostsAccentCache, RepeatEnsureDoesNotChurnTheCache) {
  ASSERT_EQ(AccentCacheSize(), 4u);

  EnsureCachedAccent(kAccentA, 0.0f);
  EnsureCachedAccent(kAccentB, 0.0f);
  EnsureCachedAccent(kAccentC, 0.0f);

  for (int i = 0; i < 16; ++i) {
    EnsureCachedAccent(kAccentA, 0.0f);
  }

  EXPECT_TRUE(IsAccentCached(kAccentA, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentB, 0.0f));
  EXPECT_TRUE(IsAccentCached(kAccentC, 0.0f));

  EnsureCachedAccent(kAccentD, 0.0f);
  EnsureCachedAccent(kAccentE, 0.0f);

  EXPECT_FALSE(IsAccentCached(kAccentA, 0.0f));
}
