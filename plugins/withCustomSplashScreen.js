// plugins/withCustomSplashScreen.js - NEUTRALIZED VERSION
const { withAndroidStyles } = require('@expo/config-plugins');

const ANDROID_NS = 'http://schemas.android.com/apk/res/android';

function withCustomSplashScreen(config) {
  return withAndroidStyles(config, async (config) => {
    const styles = config.modResults;

    // NEUTRALIZATION: Ensure namespace exists but apply minimal styling
    if (!styles.resources.$) {
      styles.resources.$ = {};
    }
    if (!styles.resources.$['xmlns:android']) {
      styles.resources.$['xmlns:android'] = ANDROID_NS;
      console.log('[Plugin] Added xmlns:android to styles.xml');
    }

    // MINIMAL INTERVENTION: Ensure style array exists
    if (!Array.isArray(styles.resources.style)) {
      styles.resources.style = [];
    }
    
    let launchScreenTheme = styles.resources.style.find(
      style => style.$.name === 'Theme.App.SplashScreen'
    );

    // CREATE TRANSPARENT THEME: If theme doesn't exist
    if (!launchScreenTheme) {
      console.log("[Plugin] Creating transparent splash screen theme");
      launchScreenTheme = {
        $: { name: 'Theme.App.SplashScreen', parent: 'Theme.AppCompat.Light.NoActionBar' },
        item: []
      };
      styles.resources.style.push(launchScreenTheme);
    }
    
    if (!Array.isArray(launchScreenTheme.item)) {
      launchScreenTheme.item = [];
    }

    // NEUTRALIZATION: Remove all existing splash screen items
    launchScreenTheme.item = [];

    // TRANSPARENT BACKGROUND: Set solid black background instead of drawable
    launchScreenTheme.item.push({
      $: { name: 'android:windowBackground' },
      _: '@color/splashscreen_background' // Use color instead of drawable
    });

    // ADDITIONAL TRANSPARENCY SETTINGS
    launchScreenTheme.item.push({
      $: { name: 'android:windowNoTitle' },
      _: 'true'
    });

    launchScreenTheme.item.push({
      $: { name: 'android:windowFullscreen' },
      _: 'true'
    });

    launchScreenTheme.item.push({
      $: { name: 'android:windowIsTranslucent' },
      _: 'false'
    });

    console.log('[Plugin] Applied transparent splash screen configuration');
    return config;
  });
}

module.exports = withCustomSplashScreen;