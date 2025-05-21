const { withAndroidStyles } = require('@expo/config-plugins'); // AndroidConfig might not be needed directly here

// Define the Android namespace
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';

function withCustomSplashScreen(config) {
  return withAndroidStyles(config, async (config) => {
    const styles = config.modResults;

    // Ensure the root <resources> tag has the android namespace
    if (!styles.resources.$) {
      styles.resources.$ = {}; // Initialize attributes object if it doesn't exist
    }
    if (!styles.resources.$['xmlns:android']) {
      styles.resources.$['xmlns:android'] = ANDROID_NS;
      console.log('Added xmlns:android to styles.xml'); // For debugging
    }

    // Find the splash screen theme
    // Ensure styles.resources.style is an array, as it might not exist if styles.xml is empty or very minimal
    if (!Array.isArray(styles.resources.style)) {
        styles.resources.style = [];
    }
    
    let launchScreenTheme = styles.resources.style.find(
      style => style.$.name === 'Theme.App.SplashScreen'
    );

    // If Theme.App.SplashScreen doesn't exist, you might need to create it.
    // This depends on your base theme and whether Expo always creates it.
    // For simplicity, we'll assume it should exist or handle its absence if necessary.
    if (!launchScreenTheme) {
      console.warn("Warning: Theme.App.SplashScreen not found in styles.xml. Creating it.");
      launchScreenTheme = {
        $: { name: 'Theme.App.SplashScreen', parent: '' }, // Adjust parent as needed, e.g., Theme.AppCompat.Light.NoActionBar
        item: []
      };
      styles.resources.style.push(launchScreenTheme);
    }
    
    if (!Array.isArray(launchScreenTheme.item)) {
        launchScreenTheme.item = []; // Ensure item is an array
    }

    // Find and remove any default Expo branding items
    launchScreenTheme.item = launchScreenTheme.item.filter(
      item => item && item.$ && item.$.name && !item.$.name.includes('expo') && !item.$.name.includes('Expo')
    );

    // Ensure we're using our custom drawable for the splash screen background
    const windowBackgroundItem = launchScreenTheme.item.find(
      item => item && item.$ && item.$.name === 'android:windowBackground'
    );
    
    if (windowBackgroundItem) {
      // The attribute for the drawable within an item with android:name='android:windowBackground'
      // is usually just '_' (the text content of the item tag) or it could be a different attribute
      // if it's a complex item. For <item name="android:windowBackground">@drawable/splashscreen</item>
      // the value is in the text node.
      // However, the error message is about "android:name" for an "item" element.
      // Your original logic for adding 'android:drawable' as an attribute to the item seems like it might
      // be creating an unexpected structure. Let's stick to the standard way of defining such items.
      // A standard item for windowBackground looks like:
      // <item name="android:windowBackground">@drawable/splashscreen</item>
      // The config plugin representation for this would be:
      // { $: { name: 'android:windowBackground' }, _: '@drawable/splashscreen' }

      // Let's assume the error is purely namespace and your item structure is intended.
      // If windowBackgroundItem.$['android:drawable'] was how you set it before.
      windowBackgroundItem.$['android:drawable'] = '@drawable/splashscreen'; // Keeping your original logic for this part if it worked before namespace fix
                                                                            // However, typical item for background is <item name="android:windowBackground">@drawable/...</item>
                                                                            // which translates to item._ = "@drawable/..."
                                                                            // Let's correct it to the standard:
      // Correct way to set the value for an item like <item name="android:windowBackground">VALUE</item>
      windowBackgroundItem._ = '@drawable/splashscreen';
      delete windowBackgroundItem.$['android:drawable']; // Remove if it was there incorrectly


    } else {
      launchScreenTheme.item.push({
        $: {
          name: 'android:windowBackground' // Expo config plugins usually handle the 'android:' prefix correctly if namespace is present
        },
        _: '@drawable/splashscreen' // Value of the item
      });
    }

    return config;
  });
}

module.exports = withCustomSplashScreen;