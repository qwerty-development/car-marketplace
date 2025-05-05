# Keep Google Maps classes
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-keep class com.google.maps.** { *; }

# Keep react-native-maps classes
-keep class com.airbnb.android.react.maps.** { *; }
-keepclassmembers class com.airbnb.android.react.maps.** { *; }

# Keep custom marker view classes
-keepclassmembers class * implements com.google.android.gms.maps.GoogleMap$InfoWindowAdapter {
    *;
}

# Optimization settings that help with map rendering
-optimizations !code/simplification/variable
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application