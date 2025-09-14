
#ifndef __MALWARE_SNITCH_SCANNER_H_
#define __MALWARE_SNITCH_SCANNER_H_

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <vector>
#include <string>
#include <memory>

#include <json.hpp>

#define VIRUS_TOTAL_API_URL "https://www.virustotal.com/api/v3"
#define VIRUS_TOTAL_FILES_ROUTE "/files"
#define VIRUS_TOTAL_UPLOAD_ROUTE VIRUS_TOTAL_FILES_ROUTE "/upload_url"

namespace malware_snitch {
using json = nlohmann::json;

/** 
 * @class Scanner
 * @brief A class that represents a scanner for malware detection.
 * It performs various operations on a set of files. The scanner uploads them to VirusTotal, 
 * checks their status, and downloads the results. It also checks for signatures in the files.
 */
class Scanner {
  public:
    /**
     * @brief Construct or initialize the scanner.
     * @param aFiles A vector of file paths to be scanned.
     */
    static auto Singleton(std::vector<std::string> aFiles) -> Scanner*;
    /**
     * @brief Uploads files to VirusTotal, check for their status, and download results.
     * @param aKey The API key for VirusTotal. 
     */ 
    auto CheckFiles(const std::string& aKey) -> int;

    ~Scanner() = default;
  private:
    Scanner(std::vector<std::string> aFiles) : mFiles(aFiles) {}

    /**
     * @brief Uploads a file to VirusTotal.
     * @return The response from the upload request for each file.
     */
    auto UploadFile(const std::string& aKey) -> std::vector<json>;
    /**
     * @brief Calculates the SHA256 hash of the given files.
     * @return A list of SHA256 hashes.
     */
    auto CalculateSHA256Files() -> std::vector<std::string>;
    /**
     * @brief Checks the status of the uploaded files.
     * @return The response from the status check request.
     */
    auto CheckStatus(const std::string& aKey) -> json;
  protected:
    std::vector<std::string> mFiles; ///< The files to be scanned.
};

} // namespace malware_snitch
#endif // __MALWARE_SNITCH_SCANNER_H_