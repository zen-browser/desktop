/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gtest/gtest.h"

#include "Windows11LimitedAccessFeatures.h"
#include "WinUtils.h"

TEST(LimitedAccessFeature, VerifyGeneratedInfo)
{
  // If running on MSIX we have no guarantee that the
  // generated LAF info will match the known values.
  if (mozilla::widget::WinUtils::HasPackageIdentity()) {
    return;
  }

  LimitedAccessFeatureInfo knownLafInfo = {
      // Win11LimitedAccessFeatureType::Taskbar
      "Win11LimitedAccessFeatureType::Taskbar"_ns,      // debugName
      u"com.microsoft.windows.taskbar.pin"_ns,          // feature
      u"kRFiWpEK5uS6PMJZKmR7MQ=="_ns,                   // token
      u"pcsmm0jrprpb2 has registered their use of "_ns  // attestation
      u"com.microsoft.windows.taskbar.pin with Microsoft and agrees to the "_ns
      u"terms "_ns
      u"of use."_ns};

  auto generatedLafInfoResult = GenerateLimitedAccessFeatureInfo(
      "Win11LimitedAccessFeatureType::Taskbar"_ns,
      u"com.microsoft.windows.taskbar.pin"_ns);
  ASSERT_TRUE(generatedLafInfoResult.isOk());
  LimitedAccessFeatureInfo generatedLafInfo = generatedLafInfoResult.unwrap();

  // Check for equality between generated values and known good values
  ASSERT_TRUE(knownLafInfo.debugName.Equals(generatedLafInfo.debugName));
  ASSERT_TRUE(knownLafInfo.feature.Equals(generatedLafInfo.feature));
  ASSERT_TRUE(knownLafInfo.token.Equals(generatedLafInfo.token));
  ASSERT_TRUE(knownLafInfo.attestation.Equals(generatedLafInfo.attestation));
}
