const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

function withCustomSplashScreen(config) {
  return withAndroidStyles(config, async (config) => {
    // Get the styles
    const styles = config.modResults;

    // Find the splash screen theme
    const launchScreenTheme = styles.resources.style.find(
      style => style.$.name === 'Theme.App.SplashScreen'
    );

    if (launchScreenTheme) {
      // Find and remove any default Expo branding items
      launchScreenTheme.item = launchScreenTheme.item.filter(
        item => !item.$.name.includes('expo') && !item.$.name.includes('Expo')
      );

      // Ensure we're using our custom drawable for the splash screen background
      const windowBackground = launchScreenTheme.item.find(
        item => item.$.name === 'android:windowBackground'
      );
      
      if (windowBackground) {
        windowBackground.$['android:drawable'] = '@drawable/splashscreen';
      } else {
        launchScreenTheme.item.push({
          $: {
            'android:name': 'android:windowBackground',
            'android:drawable': '@drawable/splashscreen'
          }
        });
      }
    }

    return config;
  });
}

module.exports = withCustomSplashScreen;