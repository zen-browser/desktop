
#include <vector>
#include <string>
#include <functional>

#ifndef __MALWARE_SNITCH_APP_H_
#define __MALWARE_SNITCH_APP_H_

namespace malware_snitch {

/**
 * @struct AppArgs
 * @brief Data structure to hold the API key and files.
 */
struct AppArgs {
  std::string api_key; ///< The API key for VirusTotal.
  std::vector<std::string> files; ///< The files to be scanned.
};

using CallBackType = std::function<int(AppArgs&)>;

/**
 * @brief Parses command line arguments and runs the scanner.
 * @param argc The number of command line arguments.
 * @param argv The command line arguments.
 * @param callback A callback function to be executed with the parsed arguments.
 * @return An integer indicating the success or failure of the operation.
 */
auto ParseArgsAndRun(int argc, char** argv, CallBackType callback) -> int;

}

#endif // __MALWARE_SNITCH_APP_H_
