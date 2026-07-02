
#include "hasher.h"

#include <stdio.h>
#include <vector>
#include <string>
#include <iostream>
#include <fstream>
#include <array>

#include <openssl/evp.h>

#define HASHER_FAIL(message) \
  std::cerr << "Hasher Error: " << message << std::endl; \
  return std::string();

namespace malware_snitch {

auto Hasher::CalculateSHA256Helper(const std::string& aFile) -> std::string {
  std::array<unsigned char, EVP_MAX_MD_SIZE> hash;
  unsigned int hashLength = 0;
  EVP_MD_CTX* ctx = EVP_MD_CTX_new();
  if (!ctx) {
    HASHER_FAIL("Failed to create EVP_MD_CTX");
  }
  if (EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr) != 1) {
    EVP_MD_CTX_free(ctx);
    HASHER_FAIL("Failed to initialize digest context");
  }
  std::ifstream file(aFile, std::ios::binary);
  if (!file) {
    EVP_MD_CTX_free(ctx);
    HASHER_FAIL("Failed to open file: " + aFile);
  }
  std::vector<char> buffer(8192);
  while (file) {
    file.read(buffer.data(), buffer.size());
    std::streamsize bytesRead = file.gcount();
    if (bytesRead > 0) {
      if (EVP_DigestUpdate(ctx, buffer.data(), bytesRead) != 1) {
        EVP_MD_CTX_free(ctx);
        HASHER_FAIL("Failed to update digest");
      }
    }
  }
  if (EVP_DigestFinal_ex(ctx, hash.data(), &hashLength) != 1) {
    EVP_MD_CTX_free(ctx);
    HASHER_FAIL("Failed to finalize digest");
  }
  EVP_MD_CTX_free(ctx);
  return HashToString<EVP_MAX_MD_SIZE>(hash, hashLength);
}

auto Hasher::CalculateSHA256Files(const std::vector<std::string>& aFiles) -> std::vector<std::string> {
  std::vector<std::string> hashes;
  for (const auto& file : aFiles) {
    hashes.push_back(CalculateSHA256(file));
  }
  return hashes;
}

auto Hasher::CalculateSHA256(const std::string& aFile) -> std::string {
  auto hash = CalculateSHA256Helper(aFile);
  std::cout << "\t[+] Hashed: " << aFile << " -> " << hash << std::endl;
  return hash;
}

}; // namespace malware_snitch
