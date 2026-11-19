/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef WINDOWS_DEFAULT_BROWSER_TESTS_H_
#define WINDOWS_DEFAULT_BROWSER_TESTS_H_

#include <gtest/gtest.h>

#include <windows.h>

#include "mozilla/UniquePtr.h"
#include "WindowsDefaultBrowser.h"

class FindSetDefaultBrowserButtonTests : public ::testing::Test {
 protected:
  static void SetUpTestSuite();
  static void TearDownTestSuite();
  void TearDown() override;
  void TerminateSystemSettings();
  static UIWindowElement WaitForSetDefaultBrowserButton();

 private:
  static void RegisterAsBrowser();
  static void UnregisterAsBrowser();

  static mozilla::UniquePtr<WCHAR[]> sAppRegName;
};

#endif
