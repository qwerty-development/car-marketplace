const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Define the source paths for your splash screen assets
const SPLASH_SCREEN_XML_SOURCE_PATH = path.join('assets', 'splash', 'drawable', 'splashscreen.xml');
const SPLASH_IMAGE_SOURCE_PATH = path.join('assets', 'splash', 'drawable', 'splashscreen_image.png'); // Adjust extension if needed

function withCopySplashAssets(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidResDrawablePath = path.join(
        config.modRequest.platformProjectRoot, // This is 'android/'
        'app', 'src', 'main', 'res', 'drawable'
      );

      // Files to copy: [source, destinationName]
      const filesToCopy = [
        {
          source: path.join(projectRoot, SPLASH_SCREEN_XML_SOURCE_PATH),
          destName: 'splashscreen.xml'
        },
        {
          source: path.join(projectRoot, SPLASH_IMAGE_SOURCE_PATH),
          destName: 'splashscreen_image.png' // Ensure this matches the @drawable/splashscreen_image reference
        }
      ];

      // Ensure the target directory exists
      if (!fs.existsSync(androidResDrawablePath)) {
        fs.mkdirSync(androidResDrawablePath, { recursive: true });
        console.log(`[withCopySplashAssets] Created directory: ${androidResDrawablePath}`);
      } else {
        console.log(`[withCopySplashAssets] Directory already exists: ${androidResDrawablePath}`);
      }
      
      for (const file of filesToCopy) {
        const destPath = path.join(androidResDrawablePath, file.destName);
        if (fs.existsSync(file.source)) {
          try {
            fs.copyFileSync(file.source, destPath);
            console.log(`[withCopySplashAssets] Copied ${file.source} to ${destPath}`);
          } catch (e) {
            console.error(`[withCopySplashAssets] Error copying ${file.source} to ${destPath}:`, e);
            throw e; // Rethrow to fail the build if essential files are missing
          }
        } else {
          console.error(`[withCopySplashAssets] Source file not found: ${file.source}. Skipping copy.`);
          // Depending on how critical the file is, you might want to throw an error:
          // throw new Error(`[withCopySplashAssets] Essential splash screen asset not found: ${file.source}`);
        }
      }
      
      return config;
    },
  ]);
}

module.exports = withCopySplashAssets;