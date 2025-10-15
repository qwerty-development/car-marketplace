import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

/**
 * Process and optimize image for upload
 * - Converts all images to WebP format (both iOS and Android)
 * - Resizes to max 1080x1080 while maintaining aspect ratio
 * - Applies intelligent compression based on file size
 * - Handles iOS photos with special optimization
 * 
 * @param uri - The URI of the image to process
 * @returns Promise<string> - The URI of the processed image
 */
export const processImageToWebP = async (uri: string): Promise<string> => {
  if (!uri) {
    console.warn("processImageToWebP: No URI provided.");
    return "";
  }

  try {
    // Step 1: Get file information and analyze source characteristics
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) throw new Error("File does not exist");

    console.log(
      `Original file size: ${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB`
    );

    // Step 2: Detect iOS photos (typically larger with more metadata)
    const isLikelyiOSPhoto =
      uri.includes("HEIC") ||
      uri.includes("IMG_") ||
      uri.includes("DCIM") ||
      uri.endsWith(".HEIC") ||
      uri.endsWith(".heic") ||
      fileInfo.size > 3 * 1024 * 1024;

    // Step 3: Get original image dimensions
    const imageMeta = await ImageManipulator.manipulateAsync(uri, []);
    const originalWidth = imageMeta.width;
    const originalHeight = imageMeta.height;

    if (!originalWidth || !originalHeight) {
      throw new Error("Unable to determine original image dimensions");
    }

    console.log(`Original dimensions: ${originalWidth}×${originalHeight}`);

    // Step 4: Calculate target dimensions while preserving aspect ratio
    // Higher resolution for car marketplace - buyers need to see details!
    const MAX_WIDTH = 1920;  // Full HD width for quality
    const MAX_HEIGHT = 1920; // Full HD height for quality
    const aspectRatio = originalWidth / originalHeight;

    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    if (originalWidth > MAX_WIDTH || originalHeight > MAX_HEIGHT) {
      if (aspectRatio > 1) {
        // Landscape orientation
        targetWidth = MAX_WIDTH;
        targetHeight = Math.round(MAX_WIDTH / aspectRatio);
      } else {
        // Portrait orientation
        targetHeight = MAX_HEIGHT;
        targetWidth = Math.round(MAX_HEIGHT * aspectRatio);
      }
    }

    console.log(`Target dimensions: ${targetWidth}×${targetHeight}`);

    // Step 5: HIGH-QUALITY compression optimized for car marketplace
    // WebP maintains better quality than JPEG at same file size
    // Using conservative compression to preserve car details (scratches, interior, etc.)
    let compressionLevel = 0.75; // High quality default 

    if (fileInfo.size > 15 * 1024 * 1024) {
      compressionLevel = 0.75; // Still high quality for very large images (25% compression)
    } else if (fileInfo.size > 8 * 1024 * 1024 || isLikelyiOSPhoto) {
      compressionLevel = 0.80; // Balanced high quality (20% compression)
    }
    
    console.log(`Using compression level: ${compressionLevel} (${Math.round((1 - compressionLevel) * 100)}% compression)`);

    // Step 6: First-pass optimization with WebP format for both iOS and Android
    const firstPass = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: targetWidth, height: targetHeight } }],
      {
        compress: compressionLevel,
        format: ImageManipulator.SaveFormat.WEBP, // Always use WebP
      }
    );

    if (!firstPass.uri) {
      throw new Error("First-pass image processing failed: no URI returned");
    }

    // Step 7: For iOS photos or large images, apply second-pass to optimize further
    let finalResult = firstPass;

    if (isLikelyiOSPhoto || fileInfo.size > 5 * 1024 * 1024) {
      try {
        console.log("Applying second-pass optimization");
        finalResult = await ImageManipulator.manipulateAsync(
          firstPass.uri,
          [], // No transformations, just re-encode
          {
            compress: compressionLevel,
            format: ImageManipulator.SaveFormat.WEBP,
            base64: false,
          }
        );

        if (!finalResult.uri) {
          console.warn(
            "Second-pass processing failed, using first-pass result"
          );
          finalResult = firstPass; // Fallback to first pass
        }
      } catch (secondPassError) {
        console.warn("Error in second-pass processing:", secondPassError);
        finalResult = firstPass; // Fallback to first pass
      }
    }

    // Step 8: Verify final file size and report compression metrics
    const processedInfo = await FileSystem.getInfoAsync(finalResult.uri);
    if (processedInfo.exists && processedInfo.size) {
      console.log(
        `Processed image size: ${(processedInfo.size / (1024 * 1024)).toFixed(
          2
        )}MB`
      );

      // Calculate and log compression ratio
      if (fileInfo.size) {
        const ratio = ((processedInfo.size / fileInfo.size) * 100).toFixed(1);
        console.log(`Compression ratio: ${ratio}% of original`);
      }
    }

    return finalResult.uri;
  } catch (error) {
    console.error("processImageToWebP error:", error);
    // Return original URI as fallback
    return uri;
  }
};

/**
 * Get the appropriate file extension and content type for WebP
 */
export const getWebPFileInfo = () => {
  return {
    extension: "webp",
    contentType: "image/webp",
  };
};
