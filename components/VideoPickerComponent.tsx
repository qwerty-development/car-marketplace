import React, { useCallback, useState } from 'react';
import { TouchableOpacity, Text, View, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { FFmpegKit } from 'ffmpeg-kit-react-native'; // make sure this package is installed

interface VideoAsset {
  uri: string;
  width: number;
  height: number;
  duration: number;
  type?: string;
  fileSize?: number;
}

interface VideoPickerButtonProps {
  onVideoSelect: (video: VideoAsset) => void;
  videoUri?: string;
  maxDuration?: number;
  maxSize?: number;
  error?: string;
  disabled?: boolean;
}

export default function VideoPickerButton({
  onVideoSelect,
  videoUri,
  maxSize = 5 * 1024 * 1024, // 5MB target
  maxDuration = 20,
  error,
  disabled,
}: VideoPickerButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Validate video dimensions, duration, size, etc.
  const validateVideo = useCallback(
    async (uri: string, duration: number, fileSize?: number) => {
      if (duration > maxDuration * 1000) {
        throw new Error(`Video must be ${maxDuration} seconds or shorter`);
      }

      if (!fileSize) {
        const fileInfo: any = await FileSystem.getInfoAsync(uri);
        fileSize = fileInfo.size;
      }

      if (fileSize && fileSize > maxSize) {
        // We will attempt compression if fileSize > maxSize.
        return;
      }
    },
    [maxDuration, maxSize]
  );

  // Function to compress video using FFmpeg.
  const compressVideo = async (inputUri: string, duration: number): Promise<string> => {
    // 5 MB target file size.
    const targetFileSizeBytes = 5 * 1024 * 1024;
    const audioBitrate = 128000; // 128 kbps in bits per second
    const targetFileSizeBits = targetFileSizeBytes * 8;

    // Compute target video bitrate in bits per second.
    // (Subtract audio contribution from total bits)
    let targetVideoBitrate = Math.floor((targetFileSizeBits - audioBitrate * duration) / duration);
    if (targetVideoBitrate < 100000) {
      // Set a minimum video bitrate (e.g., 100 kbps) to avoid extremely low quality.
      targetVideoBitrate = 100000;
    }

    const outputUri = FileSystem.cacheDirectory + 'compressedVideo.mp4';
    // Build FFmpeg command. (You might consider a two-pass command for improved quality.)
    const command = `-i "${inputUri}" -c:a aac -b:a 128k -c:v libx264 -b:v ${targetVideoBitrate} "${outputUri}"`;

    console.log('Running FFmpeg command:', command);
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (returnCode.isValueSuccess()) {
      return outputUri;
    } else {
      throw new Error('Video compression failed');
    }
  };

  const pickVideo = async () => {
    try {
      setIsLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Permission required');

      // Use ImagePicker to let user select video.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        // Do not set a fixed export preset here so we avoid unwanted re-encoding.
        videoMaxDuration: maxDuration,
      });

      if (!result?.assets?.[0]?.uri) return;

      const videoAsset = result.assets[0];
      const videoDuration = videoAsset.duration || 0; // duration in seconds (or milliseconds? Adjust as needed)
      let finalUri = videoAsset.uri;

      // Get file info (size, etc.)
      const fileInfo: any = await FileSystem.getInfoAsync(videoAsset.uri);
      const fileSize = fileInfo.size;

      // Validate video (duration and format)
      await validateVideo(videoAsset.uri, videoDuration * 1000, fileSize);

      // If the video is larger than maxSize (5MB), compress it.
      if (fileSize > maxSize) {
        finalUri = await compressVideo(videoAsset.uri, videoDuration);
      }

      // Determine MIME type based on file extension.
      const lowerUri = finalUri.toLowerCase();
      const type = lowerUri.endsWith('.mov')
        ? 'video/quicktime'
        : lowerUri.endsWith('.hevc')
        ? 'video/hevc'
        : 'video/mp4';

      onVideoSelect({
        uri: finalUri,
        width: videoAsset.width,
        height: videoAsset.height,
        duration: videoDuration,
        type,
        fileSize, // original size (optional—you might want to get new size info here)
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to select video');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontWeight: '600', marginBottom: 8 }}>Video *</Text>
      <TouchableOpacity
        onPress={pickVideo}
        disabled={disabled || isLoading}
        style={{
          borderWidth: 2,
          borderStyle: 'dashed',
          borderRadius: 10,
          padding: 20,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="#D55004" />
        ) : (
          <Text style={{ marginTop: 8, fontSize: 16 }}>
            {videoUri ? 'Change Video' : 'Select Video'}
          </Text>
        )}
        <Text style={{ marginTop: 4, fontSize: 12 }}>
          MP4 or MOV • Max {maxSize / (1024 * 1024)} MB • Max {maxDuration}s
        </Text>
      </TouchableOpacity>
      {error && <Text style={{ color: 'red', marginTop: 4 }}>{error}</Text>}
    </View>
  );
}
