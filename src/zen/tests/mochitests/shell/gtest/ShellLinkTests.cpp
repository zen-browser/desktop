/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gtest/gtest.h"

#include "nsDirectoryServiceDefs.h"
#include "nsDirectoryServiceUtils.h"
#include "nsWindowsShellServiceInternal.h"
#include "nsXULAppAPI.h"

TEST(ShellLink, NarrowCharacterArguments)
{
  nsCOMPtr<nsIFile> exe;
  nsresult rv = NS_GetSpecialDirectory(NS_OS_TEMP_DIR, getter_AddRefs(exe));
  ASSERT_TRUE(NS_SUCCEEDED(rv));

  RefPtr<IShellLinkW> link;
  rv = CreateShellLinkObject(exe, {u"test"_ns}, u"test"_ns, exe, 0, u"aumid"_ns,
                             getter_AddRefs(link));
  ASSERT_TRUE(NS_SUCCEEDED(rv));
  ASSERT_TRUE(link != nullptr);

  std::wstring testArgs = L"\"test\" ";

  wchar_t resultArgs[sizeof(testArgs)];
  HRESULT hr = link->GetArguments(resultArgs, sizeof(resultArgs));
  ASSERT_TRUE(SUCCEEDED(hr));

  ASSERT_TRUE(testArgs == resultArgs);
}

TEST(ShellLink, WideCharacterArguments)
{
  nsCOMPtr<nsIFile> exe;
  nsresult rv = NS_GetSpecialDirectory(NS_OS_TEMP_DIR, getter_AddRefs(exe));
  ASSERT_TRUE(NS_SUCCEEDED(rv));

  RefPtr<IShellLinkW> link;
  rv = CreateShellLinkObject(exe, {u"Test\\テスト用アカウント\\Test"_ns},
                             u"test"_ns, exe, 0, u"aumid"_ns,
                             getter_AddRefs(link));
  ASSERT_TRUE(NS_SUCCEEDED(rv));
  ASSERT_TRUE(link != nullptr);

  std::wstring testArgs = L"\"Test\\テスト用アカウント\\Test\" ";

  wchar_t resultArgs[sizeof(testArgs)];
  HRESULT hr = link->GetArguments(resultArgs, sizeof(resultArgs));
  ASSERT_TRUE(SUCCEEDED(hr));

  ASSERT_TRUE(testArgs == resultArgs);
}
