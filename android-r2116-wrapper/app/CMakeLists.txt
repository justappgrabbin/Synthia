cmake_minimum_required(VERSION 3.22.1)
project(synthia_r2116)

add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES IMPORTED_LOCATION "${CMAKE_SOURCE_DIR}/libnode/bin/${ANDROID_ABI}/libnode.so")

add_library(synthia-jni SHARED src/main/cpp/native-lib.cpp)
target_include_directories(synthia-jni PRIVATE "${CMAKE_SOURCE_DIR}/libnode/include/node")
find_library(log-lib log)
target_link_libraries(synthia-jni node ${log-lib})
