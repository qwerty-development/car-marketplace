const { withDangerousMod, WarningAggregator } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Define the custom ProGuard rules you want to add
const customRules = `
# === Custom ProGuard Rules Start ===
# Keep classes needed by react-native-maps (example)
-keep class com.airbnb.android.react.maps.** { *; }
-keep interface com.airbnb.android.react.maps.** { *; }
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }

# Add any other rules needed by your libraries here
# -keep class my.important.library.** { *; }
# === Custom ProGuard Rules End ===
`;

const withCustomProguardRules = (config) => {
  return withDangerousMod(config, [
    'android', // Platform specific modifier
    async (modConfig) => {
      // Get the path to the android project root
      const projectRoot = modConfig.modRequest.projectRoot;
      // Define the path to the proguard-rules.pro file
      const proguardRulesPath = path.join(
        projectRoot,
        'android',
        'app',
        'proguard-rules.pro'
      );

      try {
        // Read the existing ProGuard rules
        let proguardContent = '';
        if (fs.existsSync(proguardRulesPath)) {
          proguardContent = fs.readFileSync(proguardRulesPath, 'utf-8');
        } else {
          // Warn if the file doesn't exist, although it should in a standard build
          WarningAggregator.addWarningAndroid(
            'custom-proguard-rules',
            `proguard-rules.pro file not found at ${proguardRulesPath}. Creating a new one with custom rules.`
          );
        }

        // Check if custom rules are already added to prevent duplication
        if (!proguardContent.includes('# === Custom ProGuard Rules Start ===')) {
          // Append the custom rules to the existing content
          const newContent = proguardContent + '\n' + customRules;
          // Write the modified content back to the file
          fs.writeFileSync(proguardRulesPath, newContent);
        } else {
          // Optional: Log or warn if rules seem to be already present
          console.log('Custom ProGuard rules appear to be already added.');
        }

      } catch (error) {
        // Log any errors during file modification
        WarningAggregator.addWarningAndroid(
          'custom-proguard-rules',
          `Failed to add custom ProGuard rules: ${error.message}`
        );
      }

      // Return the modified configuration object
      return modConfig;
    },
  ]);
};

// Export the plugin function
module.exports = withCustomProguardRules;