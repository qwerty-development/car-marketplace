import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  BackHandler,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '@/utils/ThemeContext';
import VideoControls from '@/components/VideoControls';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/utils/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, ArrowLeft } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import openWhatsApp from '@/utils/openWhatsapp';
import { shareContent } from '@/utils/shareUtils';
import { useFocusEffect } from '@react-navigation/native';

const { height, width } = Dimensions.get('window');

interface Car {
  id: string;
  year: number;
  make: string;
  model: string;
}

interface Dealership {
  id: number;
  name: string;
  logo: string;
  phone?: string;
}

interface AutoClip {
  id: number;
  title: string;
  description: string;
  video_url: string;
  status: 'published' | 'draft';
  car_id: number;
  dealership_id: number;
  car?: Car;
  dealership?: Dealership;
  created_at: Date;
  views?: number;
  likes?: number;
  liked_users?: string[];
}

export default function SingleAutoClipPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  
  // State management
  const [clip, setClip] = useState<AutoClip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [globalMute, setGlobalMute] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  
  // Refs
  const videoRef = useRef<Video>(null);
  const viewTrackingRef = useRef<NodeJS.Timeout | null>(null);
  const hasTrackedView = useRef(false);

  // Fetch clip data
  useEffect(() => {
    const fetchClipData = async () => {
      if (!id) {
        setError('Invalid clip ID');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch clip with related data
        const { data: clipData, error: clipError } = await supabase
          .from('auto_clips')
          .select(`
            *,
            car:cars(*),
            dealership:dealerships(*),
            liked_users
          `)
          .eq('id', id)
          .eq('status', 'published')
          .single();

        if (clipError) {
          throw clipError;
        }

        if (!clipData) {
          throw new Error('Clip not found');
        }

        setClip(clipData);
        setIsLiked(clipData.liked_users?.includes(user?.id || '') || false);
      } catch (err: any) {
        console.error('Error fetching clip:', err);
        setError(err.message || 'Failed to load clip');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClipData();
  }, [id, user?.id]);

  // Track view after 5 seconds
  useEffect(() => {
    if (clip && user && !hasTrackedView.current) {
      viewTrackingRef.current = setTimeout(async () => {
        try {
          await supabase.rpc('track_autoclip_view', {
            clip_id: clip.id,
            user_id: user.id,
          });
          hasTrackedView.current = true;
          setClip(prev => prev ? { ...prev, views: (prev.views || 0) + 1 } : null);
        } catch (err) {
          console.error('Error tracking view:', err);
        }
      }, 5000);
    }

    return () => {
      if (viewTrackingRef.current) {
        clearTimeout(viewTrackingRef.current);
      }
    };
  }, [clip, user]);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.back();
        return true;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [])
  );

  // Video event handlers
  const handlePlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setVideoProgress(status.positionMillis / 1000);
      setVideoDuration(status.durationMillis / 1000);
    }
  };

  const handleVideoScrub = async (time: number) => {
    try {
      await videoRef.current?.setPositionAsync(time * 1000);
    } catch (err) {
      console.error('Error scrubbing video:', err);
    }
  };

  const handleVideoPress = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error('Error toggling video playback:', err);
    }
  };

  const handleMutePress = async (event: any) => {
    event.stopPropagation();
    const newMuteState = !globalMute;
    setGlobalMute(newMuteState);
    await videoRef.current?.setIsMutedAsync(newMuteState);
  };

  const handleLikePress = async () => {
    if (!user || !clip) return;

    try {
      const { data: newLikesCount, error } = await supabase.rpc(
        'toggle_autoclip_like',
        {
          clip_id: clip.id,
          user_id: user.id,
        }
      );

      if (error) throw error;

      setIsLiked(!isLiked);
      setClip(prev => prev ? {
        ...prev,
        likes: newLikesCount,
        liked_users: isLiked 
          ? (prev.liked_users || []).filter(id => id !== user.id)
          : [...(prev.liked_users || []), user.id]
      } : null);
    } catch (err) {
      console.error('Error toggling like:', err);
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  const handleShare = () => {
    if (!clip || !clip.car) return;
    
    shareContent({
      id: clip.id,
      type: 'autoclip',
      title: `${clip.car.year} ${clip.car.make} ${clip.car.model} - Video`,
      message: `Check out this ${clip.car.year} ${clip.car.make} ${clip.car.model} video on Fleet!${clip.description ? `\n\n${clip.description}` : ''}`
    });
  };

  // Render functions
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" color="#D55004" />
      </View>
    );
  }

  if (error || !clip) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <Text style={[styles.errorText, { color: isDarkMode ? '#fff' : '#000' }]}>
          {error || 'Clip not found'}
        </Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AutoClip</Text>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Video Player */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleVideoPress}
        style={styles.videoContainer}
      >
        <Video
          ref={videoRef}
          source={{ uri: clip.video_url }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isPlaying}
          isLooping
          isMuted={globalMute}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          onLoadStart={() => setVideoLoading(true)}
          onLoad={() => setVideoLoading(false)}
          rate={1.0}
          volume={1.0}
        />

        {videoLoading && (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={60}
            tint={isDarkMode ? 'dark' : 'light'}
          >
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#D55004" />
            </View>
          </BlurView>
        )}

        {/* Video Controls */}
        <VideoControls
          clipId={clip.id}
          duration={videoDuration}
          currentTime={videoProgress}
          isPlaying={isPlaying}
          globalMute={globalMute}
          onMutePress={handleMutePress}
          onScrub={handleVideoScrub}
          videoRef={{ current: { [clip.id]: videoRef } }}
          likes={clip.likes || 0}
          isLiked={isLiked}
          onLikePress={handleLikePress}
        />
      </TouchableOpacity>

      {/* Clip Information */}
      <ScrollView style={styles.infoContainer}>
        <View style={styles.dealershipInfo}>
          {clip.dealership?.logo && (
            <Image
              source={{ uri: clip.dealership.logo }}
              style={styles.dealershipLogo}
            />
          )}
          <View style={styles.dealershipTextContainer}>
            <Text style={[styles.dealershipName, { color: isDarkMode ? '#fff' : '#000' }]}>
              {clip.dealership?.name}
            </Text>
            <Text style={[styles.postDate, { color: isDarkMode ? '#999' : '#666' }]}>
              {formatDistanceToNow(new Date(clip.created_at), { addSuffix: true })}
            </Text>
          </View>
        </View>

        {clip.car && (
          <Text style={styles.carTitle}>
            {clip.car.year} {clip.car.make} {clip.car.model}
          </Text>
        )}

        {clip.description && (
          <TouchableOpacity
            onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            activeOpacity={0.9}
          >
            <Text
              style={[styles.description, { color: isDarkMode ? '#fff' : '#000' }]}
              numberOfLines={isDescriptionExpanded ? undefined : 3}
            >
              {clip.description}
              {clip.description.length > 100 && (
                <Text style={styles.readMore}>
                  {' '}
                  {isDescriptionExpanded ? 'Read less' : '... Read more'}
                </Text>
              )}
            </Text>
          </TouchableOpacity>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              router.push({
                pathname: "/(home)/(user)/CarDetails",
                params: { carId: clip.car.id },
              });
            }}
          >
            <Text style={styles.primaryButtonText}>View Car Details</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>

          <View style={styles.secondaryButtonsRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                if (clip.dealership?.phone) {
                  Linking.openURL(`tel:${clip.dealership.phone}`);
                }
              }}
            >
              <Ionicons name="call-outline" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                if (clip.dealership?.phone) {
                  const message = `Hi, I'm interested in the ${clip.car.year} ${clip.car.make} ${clip.car.model}`;
                  openWhatsApp(clip.dealership.phone, message);
                }
              }}
            >
              <Ionicons name="logo-whatsapp" size={24} color={isDarkMode ? '#fff' : '#000'} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shareButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoContainer: {
    width: width,
    height: width * (16 / 9), // 16:9 aspect ratio
  },
  video: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  dealershipInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dealershipLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  dealershipTextContainer: {
    flex: 1,
  },
  dealershipName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  postDate: {
    fontSize: 12,
    marginTop: 4,
  },
  carTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D55004',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  readMore: {
    color: '#D55004',
  },
  actionButtonsContainer: {
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: '#D55004',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  secondaryButton: {
    backgroundColor: 'rgba(213, 80, 4, 0.1)',
    padding: 12,
    borderRadius: 12,
    width: '45%',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#D55004',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});