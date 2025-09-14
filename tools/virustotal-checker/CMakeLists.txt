
project("malware-snitch" LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)

# Define a binary target
file(GLOB_RECURSE SOURCES src/*.cc)

set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -lcrypto -lcurl -Wall -Wextra -pedantic")

add_executable(${PROJECT_NAME} ${SOURCES})
target_include_directories(${PROJECT_NAME} PRIVATE src)
target_compile_features(${PROJECT_NAME} PRIVATE cxx_std_20)

