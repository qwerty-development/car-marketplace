const { withAndroidColors, AndroidConfig } = require('@expo/config-plugins');

/**
 * Custom plugin to set the right colors for the splash screen on Android
 */
function withSplashScreenColors(config) {
  return withAndroidColors(config, async (config) => {
    // Get the colors
    const colors = config.modResults;

    // Set the splash screen background color
    colors.resources.color = colors.resources.color || [];
    
    // Update or add the splashscreen background color
    const existingColor = colors.resources.color.find(
      color => color.$.name === 'splashscreen_background'
    );
    
    if (existingColor) {
      existingColor._ = '#000000'; // Or whatever color you want
    } else {
      colors.resources.color.push({
        $: { name: 'splashscreen_background' },
        _: '#000000' // Or whatever color you want
      });
    }

    return config;
  });
}

module.exports = withSplashScreenColors;