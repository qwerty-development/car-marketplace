const { withDangerousMod, WarningAggregator } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Defensive R8 keep rules for Fleet — RN 0.81 + New Architecture + Hermes +
// Reanimated 4 / Worklets + Sentry RN v8 + FBSDK Next 13 + Supabase Realtime.
//
// Most native libs ship "consumer" rules in their AAR (Sentry, FlashList,
// expo-image, gesture-handler) — these don't need duplication. The rules below
// cover the libs that experience has shown to be brittle under R8 reflection.
//
// IMPORTANT: keep this in sync with android/app/proguard-rules.pro after each
// `expo prebuild` so direct edits to the regenerated file don't drift away.

const customRules = `
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
`;

const withCustomProguardRules = (config) => {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const proguardRulesPath = path.join(
        projectRoot,
        'android',
        'app',
        'proguard-rules.pro'
      );

      try {
        let proguardContent = '';
        if (fs.existsSync(proguardRulesPath)) {
          proguardContent = fs.readFileSync(proguardRulesPath, 'utf-8');
        } else {
          WarningAggregator.addWarningAndroid(
            'custom-proguard-rules',
            `proguard-rules.pro file not found at ${proguardRulesPath}. Creating a new one with custom rules.`
          );
        }

        // Strip any previously-injected block so re-runs of prebuild keep the
        // file idempotent rather than appending duplicates.
        const startMarker = '# === Fleet — defensive R8 keep rules (Phase B) ===';
        const endMarker = '# === Fleet — end defensive R8 keep rules ===';
        const startIdx = proguardContent.indexOf(startMarker);
        const endIdx = proguardContent.indexOf(endMarker);
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          proguardContent =
            proguardContent.slice(0, startIdx).trimEnd() +
            '\n' +
            proguardContent.slice(endIdx + endMarker.length).trimStart();
        }

        // Legacy block from the older plugin version — also remove so we don't
        // ship duplicate keep rules.
        const legacyStart = '# === Custom ProGuard Rules Start ===';
        const legacyEnd = '# === Custom ProGuard Rules End ===';
        const lStart = proguardContent.indexOf(legacyStart);
        const lEnd = proguardContent.indexOf(legacyEnd);
        if (lStart !== -1 && lEnd !== -1 && lEnd > lStart) {
          proguardContent =
            proguardContent.slice(0, lStart).trimEnd() +
            '\n' +
            proguardContent.slice(lEnd + legacyEnd.length).trimStart();
        }

        const newContent = proguardContent.trimEnd() + '\n' + customRules;
        fs.writeFileSync(proguardRulesPath, newContent);
      } catch (error) {
        WarningAggregator.addWarningAndroid(
          'custom-proguard-rules',
          `Failed to add custom ProGuard rules: ${error.message}`
        );
      }

      return modConfig;
    },
  ]);
};

module.exports = withCustomProguardRules;
