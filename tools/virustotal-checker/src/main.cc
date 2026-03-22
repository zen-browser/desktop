
#include "app.h"
#include "scanner.h"

#include <iostream>
#include <vector>
#include <string>
#include <optional>

namespace malware_snitch {

namespace {
/// @brief Function to convert C argv into a vector of strings
/// @param argc The number of command line arguments.
/// @param argv The command line arguments.
/// @return A vector of strings containing the command line arguments.
auto ConvertArgsToVector(int argc, char** argv) -> std::vector<std::string> {
  std::vector<std::string> args;
  for (int i = 0; i < argc; ++i) {
    args.emplace_back(argv[i]);
  }
  return args;
}

/// @brief Show CLI help message.
auto ShowHelp() -> int {
  std::cerr << "Usage: malware_snitch <API_KEY> <FILE1> <FILE2> ...\n";
  std::cerr << "Example: malware_snitch my_api_key file1.txt file2.txt\n";
  return EXIT_FAILURE;
}

/// @brief Function to fetch the API key and files from the command line arguments.
/// @param args The command line arguments as a vector of strings.
auto FetchArgs(const std::vector<std::string>& args) -> std::optional<AppArgs> {
  AppArgs app_args;
  if (args.size() < 3) {
    return std::nullopt;
  }
  app_args.api_key = args[1];
  for (size_t i = 2; i < args.size(); ++i) {
    app_args.files.emplace_back(args[i]);
  }
  return app_args;
}
} // namespace

/// @brief Function to parse command line arguments and run the scanner.
/// @param argc The number of command line arguments.
/// @param argv The command line arguments.
/// @param callback A callback function to be executed with the parsed arguments.
/// @return An integer indicating the success or failure of the operation.
auto ParseArgsAndRun(int argc, char** argv, CallBackType callback) -> int {
  auto parsedArgs = FetchArgs(ConvertArgsToVector(argc, argv));
  if (!parsedArgs.has_value()) {
    ShowHelp();
    return EXIT_FAILURE;
  }
  return callback(
    parsedArgs.value()
  );
}

/// @brief Main function to run the malware scanner.
/// @param argc The number of command line arguments.
/// @param argv The command line arguments.
/// @return An integer indicating the success or failure of the operation.
auto Main(int argc, char** argv) -> int {
  return ParseArgsAndRun(argc, argv, [](AppArgs& args) -> int {
    auto scanner = Scanner::Singleton(args.files);
    return scanner->CheckFiles(args.api_key);
  });
}
} // namespace malware_snitch

int main(int argc, char** argv) {
  return malware_snitch::Main(argc, argv);
}
