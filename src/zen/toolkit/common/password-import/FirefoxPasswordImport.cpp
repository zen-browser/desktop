/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include <algorithm>
#include <array>
#include <cstdio>
#include <iostream>
#include <string>
#include <vector>

#include "nss.h"
#include "plbase64.h"
#include "prmem.h"
#include "pk11pub.h"
#include "pk11sdr.h"
#include "secitem.h"

#ifdef XP_WIN
#  include <fcntl.h>
#  include <io.h>
#  include <windows.h>
#endif

namespace {
constexpr size_t kMaximumLineLength = 131072;

bool ReadLine(std::string& aLine) {
  aLine.clear();
  char value;
  while (std::cin.get(value)) {
    if (value == '\n') {
      return true;
    }
    if (aLine.size() >= kMaximumLineLength) {
      return false;
    }
    aLine.push_back(value);
  }
  return false;
}

void Clear(std::string& aValue) {
  volatile char* data = aValue.empty() ? nullptr : &aValue[0];
  for (size_t i = 0; i < aValue.size(); ++i) {
    data[i] = 0;
  }
  aValue.clear();
}

SECItem* DecodeBase64(const std::string& aValue) {
  if (aValue.empty() || aValue.size() % 4) {
    return nullptr;
  }
  size_t padding = aValue.back() == '=' ? 1 : 0;
  if (padding && aValue[aValue.size() - 2] == '=') {
    ++padding;
  }
  SECItem* item =
      SECITEM_AllocItem(nullptr, nullptr, aValue.size() / 4 * 3 - padding);
  if (!item || !PL_Base64Decode(aValue.c_str(), aValue.size(),
                                reinterpret_cast<char*>(item->data))) {
    if (item) {
      SECITEM_ZfreeItem(item, PR_TRUE);
    }
    return nullptr;
  }
  return item;
}

SECItem* DecodeURL(std::string aValue) {
  std::replace(aValue.begin(), aValue.end(), '-', '+');
  std::replace(aValue.begin(), aValue.end(), '_', '/');
  while (aValue.size() % 4) {
    aValue.push_back('=');
  }
  return DecodeBase64(aValue);
}

bool DecryptRust(const std::string& aValue, PK11SlotInfo* aSlot,
                 SECItem* aPlaintext) {
  std::array<std::string, 5> fields;
  size_t start = 2;
  for (size_t i = 0; i < fields.size(); ++i) {
    size_t end = aValue.find('.', start);
    if ((end == std::string::npos) != (i == 4)) {
      return false;
    }
    fields[i] = aValue.substr(start, end - start);
    start = end + 1;
  }
  if (!fields[1].empty()) {
    return false;
  }
  SECItem* iv = DecodeURL(fields[2]);
  SECItem* ciphertext = DecodeURL(fields[3]);
  SECItem* tag = DecodeURL(fields[4]);
  char keyName[] = "as-logins-key";
  PK11SymKey* key = PK11_ListFixedKeysInSlot(aSlot, keyName, nullptr);
  bool success = false;
  if (iv && iv->len == 12 && ciphertext && tag && tag->len == 16 && key) {
    std::vector<unsigned char> input(ciphertext->data,
                                     ciphertext->data + ciphertext->len);
    input.insert(input.end(), tag->data, tag->data + tag->len);
    CK_GCM_PARAMS gcm = {
        iv->data,         iv->len,
        iv->len * 8,      reinterpret_cast<unsigned char*>(fields[0].data()),
        fields[0].size(), 128};
    SECItem params = {siBuffer, reinterpret_cast<unsigned char*>(&gcm),
                      sizeof(gcm)};
    if (SECITEM_AllocItem(nullptr, aPlaintext, input.size())) {
      success = PK11_Decrypt(key, CKM_AES_GCM, &params, aPlaintext->data,
                             &aPlaintext->len, input.size(), input.data(),
                             input.size()) == SECSuccess;
      if (!success) {
        // On authentication failure NSS may reset the output length. Wipe the
        // whole allocation before the caller releases it.
        aPlaintext->len = input.size();
      }
    }
  }
  if (iv) SECITEM_ZfreeItem(iv, PR_TRUE);
  if (ciphertext) SECITEM_ZfreeItem(ciphertext, PR_TRUE);
  if (tag) SECITEM_ZfreeItem(tag, PR_TRUE);
  if (key) PK11_FreeSymKey(key);
  return success;
}

int ImportPasswords(const std::string& aDirectory) {
  // NSS is process-global. This helper never initializes Zen's live key store.
  std::string database = "sql:" + aDirectory;
  if (NSS_Initialize(database.c_str(), "", "", SECMOD_DB,
                     NSS_INIT_READONLY | NSS_INIT_NOMODDB |
                         NSS_INIT_NOROOTINIT) != SECSuccess) {
    return 2;
  }

  std::string encodedPassword;
  if (!ReadLine(encodedPassword)) {
    NSS_Shutdown();
    return 2;
  }
  SECItem* password = encodedPassword.empty()
                          ? SECITEM_AllocItem(nullptr, nullptr, 0)
                          : DecodeBase64(encodedPassword);
  Clear(encodedPassword);
  PK11SlotInfo* slot = PK11_GetInternalKeySlot();
  if (!password || !slot) {
    if (password) {
      SECITEM_ZfreeItem(password, PR_TRUE);
    }
    if (slot) {
      PK11_FreeSlot(slot);
    }
    NSS_Shutdown();
    return 2;
  }
  std::string passphrase;
  if (password->len) {
    passphrase.assign(reinterpret_cast<char*>(password->data), password->len);
  }
  SECITEM_ZfreeItem(password, PR_TRUE);
  SECStatus authenticated = PK11_CheckUserPassword(slot, passphrase.c_str());
  Clear(passphrase);
  if (authenticated != SECSuccess) {
    PK11_FreeSlot(slot);
    NSS_Shutdown();
    return 3;
  }
  std::cout << "READY\n" << std::flush;

  std::string ciphertext;
  while (ReadLine(ciphertext)) {
    bool rust = ciphertext.rfind("G:", 0) == 0;
    SECItem* input = rust ? nullptr : DecodeBase64(ciphertext);
    SECItem plaintext = {siBuffer, nullptr, 0};
    bool success = rust ? DecryptRust(ciphertext, slot, &plaintext)
                        : input && PK11SDR_Decrypt(input, &plaintext,
                                                   nullptr) == SECSuccess;
    if (!success) {
      // Failure is per field; the caller skips the affected login.
      std::cout << "!\n";
    } else if (!plaintext.len) {
      std::cout << '\n';
    } else {
      char* output = PL_Base64Encode(reinterpret_cast<char*>(plaintext.data),
                                     plaintext.len, nullptr);
      if (output) {
        std::cout << output << '\n';
        volatile char* bytes = output;
        for (size_t i = 0; output[i]; ++i) bytes[i] = 0;
        PR_Free(output);
      } else {
        std::cout << "!\n";
      }
    }
    if (input) {
      SECITEM_ZfreeItem(input, PR_TRUE);
    }
    SECITEM_ZfreeItem(&plaintext, PR_FALSE);
    Clear(ciphertext);
  }
  PK11_FreeSlot(slot);
  return NSS_Shutdown() == SECSuccess ? 0 : 2;
}
}  // namespace

#ifdef XP_WIN
int wmain(int argc, wchar_t* argv[]) {
  if (argc != 2) {
    return 2;
  }
  // The IPC protocol always uses LF, including on Windows.
  if (_setmode(_fileno(stdin), _O_BINARY) == -1 ||
      _setmode(_fileno(stdout), _O_BINARY) == -1) {
    return 2;
  }
  int length = WideCharToMultiByte(CP_UTF8, 0, argv[1], -1, nullptr, 0, nullptr,
                                   nullptr);
  if (length <= 0) {
    return 2;
  }
  std::string path(length, '\0');
  WideCharToMultiByte(CP_UTF8, 0, argv[1], -1, path.data(), length, nullptr,
                      nullptr);
  path.resize(length - 1);
  return ImportPasswords(path);
}
#else
int main(int argc, char* argv[]) {
  return argc == 2 ? ImportPasswords(argv[1]) : 2;
}
#endif
