# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# === Fleet — defensive R8 keep rules (Phase B) ===

# --- Reanimated 4 + Worklets ---
# Consumer rules ship but worklet reflection is fragile under aggressive R8.
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.jni.HybridData { *; }

# --- React Native bridge annotations ---
-keepclassmembers class * { @com.facebook.react.bridge.ReactMethod *; }
-keepclasseswithmembers class * { @com.facebook.react.uimanager.annotations.ReactProp *; }
-keepclasseswithmembers class * { @com.facebook.react.uimanager.annotations.ReactPropGroup *; }
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keepclassmembers class * { @com.facebook.proguard.annotations.KeepGettersAndSetters *; }

# --- Gesture handler / screens ---
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# --- Maps (Airbnb wrapper + Google Play services) ---
-keep class com.airbnb.android.react.maps.** { *; }
-keep interface com.airbnb.android.react.maps.** { *; }
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }

# --- Facebook SDK (adv tracking can be reflection-loaded) ---
-keep class com.facebook.appevents.** { *; }
-keep class com.facebook.internal.** { *; }
-dontwarn com.facebook.**

# --- Kotlin metadata / coroutines (Supabase realtime, OkHttp WebSocket) ---
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*
-keep class kotlin.Metadata { *; }
-keep class kotlinx.coroutines.** { *; }
-keep class kotlinx.serialization.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-keepclassmembers class * implements okhttp3.WebSocketListener { *; }

# --- Hermes intrinsics ---
-keep class com.facebook.hermes.intl.** { *; }
-keep class com.facebook.hermes.reactexecutor.** { *; }

# --- expo-image / Glide (used by CachedImage in CarCard) ---
-keep class com.bumptech.glide.** { *; }
-keep class * implements com.bumptech.glide.module.GlideModule { *; }
-keep public class * extends com.bumptech.glide.AppGlideModule
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** { *; }

# --- SVG ---
-keep class com.horcrux.svg.** { *; }

# --- expo-updates (OTA mechanism) ---
-keep class expo.modules.updates.** { *; }
-dontwarn expo.modules.updates.**

# --- Stack-trace symbolication for Sentry mapping ---
-renamesourcefileattribute SourceFile
-keepattributes SourceFile, LineNumberTable

# === Fleet — end defensive R8 keep rules ===
