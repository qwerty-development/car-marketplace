const { withDangerousMod, WarningAggregator } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'with-pinned-facebook-sdk-version';
const PINNED_VERSION = '18.0.3';
const MARKER = '// Added by withPinnedFacebookSdkVersion';

function withPinnedFacebookSdkVersion(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const gradlePath = path.join(projectRoot, 'android', 'build.gradle');

      try {
        if (!fs.existsSync(gradlePath)) {
          WarningAggregator.addWarningAndroid(
            PLUGIN_NAME,
            `android/build.gradle not found at ${gradlePath}. Skipping Facebook SDK version pin.`
          );
          return modConfig;
        }

        const source = fs.readFileSync(gradlePath, 'utf-8');
        if (source.includes(MARKER) || source.includes('facebookSdkVersion')) {
          return modConfig;
        }

        const injection = [
          '',
          MARKER,
          "if (!rootProject.ext.has('facebookSdkVersion')) {",
          `  rootProject.ext.set('facebookSdkVersion', '${PINNED_VERSION}')`,
          '}',
          '',
        ].join('\n');

        fs.writeFileSync(gradlePath, source + injection);
      } catch (error) {
        WarningAggregator.addWarningAndroid(
          PLUGIN_NAME,
          `Failed to pin Facebook SDK version: ${error.message}`
        );
      }

      return modConfig;
    },
  ]);
}

module.exports = withPinnedFacebookSdkVersion;
