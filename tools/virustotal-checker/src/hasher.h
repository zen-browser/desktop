

#ifndef __MALWARE_SNITCH_HASHER_H_
#define __MALWARE_SNITCH_HASHER_H_

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <vector>
#include <string>
#include <memory>
#include <array>
#include <sstream>
#include <iomanip>

namespace malware_snitch {

/**
 * @class Hasher
 * @brief A class with the purpose of calculating the SHA256 hash of a file.
 * It provides a method to calculate the hash and return it as a string.
 */
class Hasher {
  public:
    /**
     * @brief Calculates the SHA256 hash of a file.
     * @param aFile The path to the file.
     * @return The SHA256 hash as a string.
     */
    static auto CalculateSHA256(const std::string& aFile) -> std::string;
    /** 
     * @brief Calculates the SHA256 hash from a list of files.
     * @param aFiles A vector of file paths.
     * @return A vector of SHA256 hashes.
     */
    static auto CalculateSHA256Files(const std::vector<std::string>& aFiles) -> std::vector<std::string>;
  private:
    /**
     * @brief Helper function to calculate the SHA256 hash.
     * @param aFile The path to the file.
     * @return The SHA256 hash as a string.
     */
    static auto CalculateSHA256Helper(const std::string& aFile) -> std::string;
    /**
     * @brief Converts a hash to a string.
     * @param hash The hash data.
     * @param length The length of the hash.
     * @return The hash as a string.
     */
    template <size_t N>
    static auto HashToString(const std::array<unsigned char, N> &aHash, const uint aLength) -> std::string {
      std::stringstream ss;
      for (size_t i = 0; i < aLength; ++i) {
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(aHash[i]);
      }
      return ss.str();
    }
};

} // namespace malware_snitch

#endif // __MALWARE_SNITCH_HASHER_H_
