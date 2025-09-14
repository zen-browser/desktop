
#include "scanner.h"
#include "hasher.h"

#include <stdio.h>
#include <vector>
#include <string>
#include <iostream>
#include <fstream>
#include <array>

#include <curl/curl.h>

namespace malware_snitch {

namespace {

auto CurlWriteCallback(char *contents, size_t size, size_t nmemb, void *userp) -> size_t{
  ((std::string*)userp)->append((char*)contents, size * nmemb);
  return size * nmemb;
}

auto GetFileName(const std::string& aFile) -> std::string {
  size_t pos = aFile.find_last_of("/\\");
  if (pos == std::string::npos) {
    return aFile; // No path, return the file name
  }
  return aFile.substr(pos + 1);
}

} // namespace

auto Scanner::Singleton(std::vector<std::string> aFiles) -> Scanner* {
  static Scanner* instance = new Scanner(aFiles);
  return instance;
}

auto Scanner::CheckFiles(const std::string& aKey) -> int {
  auto uploadResponses = UploadFile(aKey);
  auto statusResponse = CheckStatus(aKey);
  // Process the responses as needed
  return 0;
}

auto Scanner::UploadFile(const std::string& aKey) -> std::vector<json> {
  auto hashes = CalculateSHA256Files();
  for (uint i = 0; i < mFiles.size(); ++i) {
    auto& file = mFiles[i];
    auto& hash = hashes[i];
    std::cout << "\t[+] Uploading " << file << std::endl;
    CURL *hnd = curl_easy_init();
    curl_easy_setopt(hnd, CURLOPT_CUSTOMREQUEST, "POST");
    curl_easy_setopt(hnd, CURLOPT_WRITEDATA, stdout);
    curl_easy_setopt(hnd, CURLOPT_URL, VIRUS_TOTAL_API_URL VIRUS_TOTAL_UPLOAD_ROUTE);

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "accept: application/json");
    headers = curl_slist_append(headers, ("X-Apikey: " + aKey).c_str());
    headers = curl_slist_append(headers, (
      "Content-Disposition: form-data; name=\"file\"; filename=\"" + 
      GetFileName(file) + 
      "\""
    ).c_str());
    curl_easy_setopt(hnd, CURLOPT_HTTPHEADER, headers);
    std::string response;

    curl_easy_setopt(hnd, CURLOPT_WRITEFUNCTION, CurlWriteCallback);
    curl_easy_setopt(hnd, CURLOPT_WRITEDATA, &response);
    std::ifstream fileStream(file, std::ios::binary);
    if (!fileStream) {
      std::cerr << "Error: Could not open file " << file << std::endl;
      continue;
    }

    std::string fileData((std::istreambuf_iterator<char>(fileStream)), std::istreambuf_iterator<char>());
    curl_easy_setopt(hnd, CURLOPT_POSTFIELDS, fileData.c_str());
    curl_easy_setopt(hnd, CURLOPT_POSTFIELDSIZE, fileData.size());
    CURLcode ret = curl_easy_perform(hnd);

    if (ret != CURLE_OK) {
      std::cerr << "\nError: " << curl_easy_strerror(ret) << std::endl;
      exit(EXIT_FAILURE);
    }

    std::cout << "\t[+] Response: " << response << std::endl;

    auto jsonResponse = json::parse(response);
    auto uploadUrl = jsonResponse["data"];
  }
  return json();
}

auto Scanner::CalculateSHA256Files() -> std::vector<std::string> {
  return Hasher::CalculateSHA256Files(mFiles);
}

auto Scanner::CheckStatus(const std::string& aKey) -> json {
  // Implement the status check logic here
  // Use libcurl to send a GET request to VirusTotal
  // Return the response as a json object
  return json();
}

}; // namespace malware_snitch
