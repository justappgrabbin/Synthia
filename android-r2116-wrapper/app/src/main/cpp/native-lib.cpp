#include <jni.h>
#include <cstdlib>
#include <cstring>
#include "node.h"

extern "C" JNIEXPORT jint JNICALL
Java_world_synthia_r2116_MainActivity_startNodeWithArguments(
        JNIEnv *env,
        jobject,
        jobjectArray arguments) {
    jsize argc = env->GetArrayLength(arguments);
    size_t total = 0;
    for (int i = 0; i < argc; i++) {
        auto arg = (jstring) env->GetObjectArrayElement(arguments, i);
        const char *utf = env->GetStringUTFChars(arg, nullptr);
        total += std::strlen(utf) + 1;
        env->ReleaseStringUTFChars(arg, utf);
        env->DeleteLocalRef(arg);
    }
    char *buffer = (char *) std::calloc(total, 1);
    char **argv = (char **) std::calloc((size_t) argc + 1, sizeof(char *));
    if (!buffer || !argv) {
        std::free(buffer);
        std::free(argv);
        return 71;
    }
    char *cursor = buffer;
    for (int i = 0; i < argc; i++) {
        auto arg = (jstring) env->GetObjectArrayElement(arguments, i);
        const char *utf = env->GetStringUTFChars(arg, nullptr);
        size_t len = std::strlen(utf);
        std::memcpy(cursor, utf, len);
        cursor[len] = '\0';
        argv[i] = cursor;
        cursor += len + 1;
        env->ReleaseStringUTFChars(arg, utf);
        env->DeleteLocalRef(arg);
    }
    argv[argc] = nullptr;
    int result = node::Start((int) argc, argv);
    std::free(argv);
    std::free(buffer);
    return result;
}
