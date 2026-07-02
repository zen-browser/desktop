/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gtest/gtest.h"

#include "nsComponentManagerUtils.h"
#include "nsILimitedAccessFeature.h"
#include "nsIWindowsRegKey.h"
#include "nsServiceManagerUtils.h"
#include "nsString.h"

TEST(LimitedAccessFeature, UnlockAllRegistryFeatures)
{
  nsCOMPtr<nsIWindowsRegKey> rootKey =
      do_CreateInstance("@mozilla.org/windows-registry-key;1");
  ASSERT_TRUE(rootKey);

  nsresult rv = rootKey->Open(
      nsIWindowsRegKey::ROOT_KEY_LOCAL_MACHINE,
      u"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModel\\LimitedAccessFeatures"_ns,
      nsIWindowsRegKey::ACCESS_READ);
  if (NS_FAILED(rv)) {
    GTEST_SKIP();
  }

  uint32_t childCount = 0;
  rv = rootKey->GetChildCount(&childCount);
  ASSERT_TRUE(NS_SUCCEEDED(rv));

  nsCOMPtr<nsILimitedAccessFeatureService> lafService =
      do_GetService("@mozilla.org/limited-access-feature-service;1");
  ASSERT_TRUE(lafService);

  for (uint32_t i = 0; i < childCount; i++) {
    nsAutoString featureName;
    rv = rootKey->GetChildName(i, featureName);
    ASSERT_TRUE(NS_SUCCEEDED(rv));

    std::cout << "Testing Feature: " << featureName << "\n";

    nsCOMPtr<nsIWindowsRegKey> featureKey;
    rv = rootKey->OpenChild(featureName, nsIWindowsRegKey::ACCESS_QUERY_VALUE,
                            getter_AddRefs(featureKey));
    ASSERT_TRUE(NS_SUCCEEDED(rv));

    nsAutoString featureKeyValue;
    rv = featureKey->ReadStringValue(u""_ns, featureKeyValue);
    if (NS_FAILED(rv) || featureKeyValue.IsEmpty()) {
      // Key may exist with the feature key's data empty when unlocking the
      // feature is no longer required to use the related API.
      std::cout << "Feature key's data is empty, skipping...\n";
      continue;
    }

    NS_ConvertUTF16toUTF8 featureId(featureName);

    nsCOMPtr<nsILimitedAccessFeature> feature;
    rv = lafService->GenerateLimitedAccessFeature(featureId,
                                                  getter_AddRefs(feature));
    ASSERT_TRUE(NS_SUCCEEDED(rv));

    bool unlocked = false;
    rv = feature->Unlock(&unlocked);
    ASSERT_TRUE(NS_SUCCEEDED(rv));
    EXPECT_TRUE(unlocked);
  }
}
