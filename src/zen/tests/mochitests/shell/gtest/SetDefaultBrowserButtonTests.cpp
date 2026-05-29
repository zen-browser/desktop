/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <gtest/gtest.h>
#include <gmock/gmock.h>

#include <string_view>
#include <string>
#include <windows.h>
#include <ole2.h>
#include <tlhelp32.h>
#include <uiautomation.h>

#include "mozilla/Maybe.h"
#include "mozilla/UniquePtr.h"
#include "WindowsDefaultBrowser.h"

static bool RegWriteStringValue(HKEY aRoot, std::wstring_view aKey,
                                const mozilla::Maybe<std::wstring>& aName,
                                std::wstring_view aValue) {
  HKEY key;
  LSTATUS ls{::RegCreateKeyExW(aRoot, aKey.data(), 0, nullptr,
                               REG_OPTION_NON_VOLATILE, KEY_SET_VALUE, nullptr,
                               &key, nullptr)};

  if (ls != ERROR_SUCCESS) {
    return false;
  }

  const BYTE* value{reinterpret_cast<const BYTE*>(aValue.data())};
  const DWORD size{static_cast<DWORD>((aValue.size() + 1) * sizeof(WCHAR))};
  ls = ::RegSetValueExW(key, aName ? aName->c_str() : nullptr, 0, REG_SZ, value,
                        size);

  ::RegCloseKey(key);

  return (ls == ERROR_SUCCESS);
}

static bool RegDeleteValue(HKEY aRoot, std::wstring_view aKey,
                           std::wstring_view aName) {
  HKEY key;
  LSTATUS ls{
      ::RegOpenKeyExW(HKEY_CURRENT_USER, aKey.data(), 0, KEY_SET_VALUE, &key)};

  if (ls == ERROR_SUCCESS) {
    ::RegDeleteValueW(key, aName.data());
    ::RegCloseKey(key);
    return true;
  }

  return false;
}

static bool RegDeleteKey(HKEY aRoot, std::wstring_view aKey) {
  LSTATUS ls{::RegDeleteTreeW(HKEY_CURRENT_USER, aKey.data())};

  return (ls == ERROR_SUCCESS);
}

static void TerminateProcessById(DWORD aProcessId) {
  HANDLE process{
      ::OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, FALSE, aProcessId)};
  if (process) {
    ::TerminateProcess(process, 0);
    ::WaitForSingleObject(process, INFINITE);
    ::CloseHandle(process);
  }
}

static void TerminateProcessByName(LPCWSTR aProcessName) {
  HANDLE processes{::CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)};
  if (processes == INVALID_HANDLE_VALUE) {
    return;
  }

  PROCESSENTRY32W process{};
  process.dwSize = sizeof(PROCESSENTRY32W);
  if (::Process32FirstW(processes, &process)) {
    do {
      if (::_wcsicmp(process.szExeFile, aProcessName) == 0) {
        TerminateProcessById(process.th32ProcessID);
      }
    } while (::Process32NextW(processes, &process));
  }
  ::CloseHandle(processes);
}

static UIWindowElement WaitForSetDefaultBrowserButton() {
  const int kMaxAttempts{40};
  const DWORD kRetryDelayMs{500};
  for (int i{0}; i < kMaxAttempts; ++i) {
    auto [window, button]{FindSetDefaultBrowserButton()};
    if (window && button) {
      return {window, button};
    }
    Sleep(kRetryDelayMs);
  }
  return {};
}

static bool IsElementFocus(const UIElement& aElement) {
  BOOL isFocus{FALSE};
  aElement->get_CurrentHasKeyboardFocus(&isFocus);
  return isFocus;
}

class SetDefaultBrowserButtonTests : public ::testing::Test {
 protected:
  static void SetUpTestSuite() {
    ASSERT_TRUE(GetAppRegName(sAppRegName));
    RegisterAsBrowser();
  }

  static void TearDownTestSuite() { UnregisterAsBrowser(); }

  void TearDown() override { TerminateSystemSettings(); }

  void TerminateSystemSettings() {
    LPCWSTR processName{L"SystemSettings.exe"};
    TerminateProcessByName(processName);
  }

 private:
  static void RegisterAsBrowser() {
    const std::wstring appRegName{sAppRegName.get()};

    WCHAR exePath[MAX_PATH];
    ::GetModuleFileNameW(nullptr, exePath, MAX_PATH);

    const std::wstring appName{L"Firefox Test"};

    // clang-format off
    // HKEY_CURRENT_USER\Software\RegisteredApplications
    {
      const std::wstring key{L"Software\\RegisteredApplications"};
      const std::wstring value{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\Capabilities"};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Some(appRegName), value));
    }
    // HKEY_CURRENT_USER\Software\Clients\StartMenuInternet\Firefox-XYZ
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Nothing(), appName));
    }
    // HKEY_CURRENT_USER\Software\Clients\StartMenuInternet\Firefox-XYZ\Capabilities
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\Capabilities"};
      const std::wstring name{L"ApplicationDescription"};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Some(name), appName));
    }
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\Capabilities"};
      const std::wstring name{L"ApplicationIcon"};
      const std::wstring value{std::wstring(exePath) + L",0"};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Some(name), value));
    }
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\Capabilities"};
      const std::wstring name{L"ApplicationName"};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Some(name), appName));
    }
    // HKEY_CURRENT_USER\Software\Clients\StartMenuInternet\Firefox-XYZ\Capabilities\URLAssociations
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\Capabilities\\URLAssociations"};
      const std::wstring name{L"http"};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Some(name), appRegName));
    }
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\Capabilities\\URLAssociations"};
      const std::wstring name{L"https"};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Some(name), appRegName));
    }
    // HKEY_CURRENT_USER\Software\Clients\StartMenuInternet\Firefox-XYZ\DefaultIcon
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\DefaultIcon"};
      const std::wstring value{std::wstring(exePath) + L",0"};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Nothing(), value));
    }
    // HKEY_CURRENT_USER\Software\Clients\StartMenuInternet\Firefox-XYZ\shell\open\command
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName + L"\\shell\\open\\command"};
      const std::wstring value{L"\"" + std::wstring(exePath) + L"\""};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Nothing(), value));
    }
    // HKEY_CURRENT_USER\Software\Classes\Firefox-XYZ\shell\open\command
    {
      const std::wstring key{L"Software\\Classes\\" + appRegName + L"\\shell\\open\\command"};
      const std::wstring value{L"\"" + std::wstring(exePath) + L"\" -osint -url \"%1\""};
      ASSERT_TRUE(RegWriteStringValue(HKEY_CURRENT_USER, key, mozilla::Nothing(), value));
    }
    // clang-format on
  }

  static void UnregisterAsBrowser() {
    const std::wstring appRegName{sAppRegName.get()};

    // clang-format off
    // HKEY_CURRENT_USER\Software\RegisteredApplications
    {
      const std::wstring key{L"Software\\RegisteredApplications"};
      ASSERT_TRUE(RegDeleteValue(HKEY_CURRENT_USER, key, appRegName));
    }
    // HKEY_CURRENT_USER\Software\Clients\StartMenuInternet\Firefox-XYZ
    {
      const std::wstring key{L"Software\\Clients\\StartMenuInternet\\" + appRegName};
      ASSERT_TRUE(RegDeleteKey(HKEY_CURRENT_USER, key));
    }
    // HKEY_CURRENT_USER\Software\Classes\Firefox-XYZ
    {
      const std::wstring key{L"Software\\Classes\\" + appRegName};
      ASSERT_TRUE(RegDeleteKey(HKEY_CURRENT_USER, key));
    }
    // clang-format on
  }

  inline static mozilla::UniquePtr<WCHAR[]> sAppRegName;
};

TEST_F(SetDefaultBrowserButtonTests, FindDefaultBrowserButton) {
  ASSERT_TRUE(LaunchModernSettingsDialogDefaultApps());

  auto [window, button]{WaitForSetDefaultBrowserButton()};
  ASSERT_THAT(window, testing::NotNull());
  ASSERT_THAT(button, testing::NotNull());
}

TEST_F(SetDefaultBrowserButtonTests, FocusDefaultBrowserButton) {
  ASSERT_TRUE(LaunchModernSettingsDialogDefaultApps());

  auto [window, button]{WaitForSetDefaultBrowserButton()};
  ASSERT_THAT(window, testing::NotNull());
  ASSERT_THAT(button, testing::NotNull());

  FocusElement(window, button);
  ASSERT_TRUE(IsElementFocus(button));
}
