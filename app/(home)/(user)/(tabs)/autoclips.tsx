import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StyleSheet,
  RefreshControl,
  Animated,
  Alert,
  Linking,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useTheme } from "@/utils/ThemeContext";
import VideoControls from "@/components/VideoControls";
import { supabase } from "@/utils/supabase";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "@/utils/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Network from "expo-network";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import SplashScreen from "../SplashScreen";
import { Ionicons } from "@expo/vector-icons";
import openWhatsApp from "@/utils/openWhatsapp";
import { shareAutoclip } from "@/utils/centralizedSharing";
import { useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';

// --- Constants ---
const { height, width } = Dimensions.get("window");
const DOUBLE_TAP_DELAY = 300;
const TAB_BAR_HEIGHT = 80;

// Performance constants
const CACHE_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB cache limit
const VIDEO_PRELOAD_BUFFER = 2; // Number of videos to preload

// FIXED: Add debounce constants
const VIDEO_STATE_DEBOUNCE = 100; // ms
const POSITION_SET_DELAY = 300; // ms

// --- Interfaces ---
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

export interface AutoClip {
  id: number;
  title: string;
  description: string;
  video_url: string;
  video_url_low?: string;
  video_url_medium?: string;
  thumbnail_url?: string;
  status: "published" | "draft";
  car_id: number;
  dealership_id: number;
  car?: Car;
  dealership?: Dealership;
  created_at: Date;
  views?: number;
  likes?: number;
  liked_users?: string[];
}

interface VideoState {
  [key: number]: boolean;
}

interface VideoPositions {
  [key: number]: number;
}

interface NetworkInfo {
  type: Network.NetworkStateType | null;
  isConnected: boolean;
  isInternetReachable: boolean;
}

// --- Video Cache Manager ---
class VideoCacheManager {
  private static instance: VideoCacheManager;
  private cacheSize: number = 0;
  private cacheMap: Map<string, { size: number; lastAccessed: number }> = new Map();

  static getInstance(): VideoCacheManager {
    if (!VideoCacheManager.instance) {
      VideoCacheManager.instance = new VideoCacheManager();
    }
    return VideoCacheManager.instance;
  }

  async getCachedVideoUri(
    videoUrl: string,
    quality: 'high' | 'medium' | 'low' = 'high'
  ): Promise<string> {
    if (!videoUrl) return '';
    
    const filename = this.generateCacheKey(videoUrl, quality);
    const localUri = FileSystem.cacheDirectory + filename;
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      
      if (fileInfo.exists && 'size' in fileInfo) {
        // Update last accessed time
        this.cacheMap.set(filename, {
          size: fileInfo.size,
          lastAccessed: Date.now(),
        });
        return localUri;
      }
      
      // Clean cache if needed before downloading
      await this.cleanCacheIfNeeded();
      
      // Download the video
      const { uri } = await FileSystem.downloadAsync(videoUrl, localUri);
      
      const newFileInfo = await FileSystem.getInfoAsync(uri);
      
      if ('size' in newFileInfo) {
        this.cacheSize += newFileInfo.size;
        this.cacheMap.set(filename, {
          size: newFileInfo.size,
          lastAccessed: Date.now(),
        });
      }
      
      return uri;
    } catch (err) {
      console.error("Error caching video:", err);
      return videoUrl; // Fallback to streaming
    }
  }

  private generateCacheKey(url: string, quality: string): string {
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1];
    return `${quality}_${filename}`;
  }

  private async cleanCacheIfNeeded(): Promise<void> {
    if (this.cacheSize < CACHE_SIZE_LIMIT) return;
    
    // Sort by last accessed time (oldest first)
    const sortedEntries = Array.from(this.cacheMap.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    );
    
    // Remove oldest files until we're under the limit
    for (const [filename, info] of sortedEntries) {
      if (this.cacheSize < CACHE_SIZE_LIMIT * 0.8) break; // Keep 20% buffer
      
      try {
        await FileSystem.deleteAsync(FileSystem.cacheDirectory + filename, { idempotent: true });
        this.cacheSize -= info.size;
        this.cacheMap.delete(filename);
      } catch (err) {
        console.error("Error deleting cache file:", err);
      }
    }
  }
}

// --- Network Monitor Hook ---
function useNetworkMonitor() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    type: null,
    isConnected: false,
    isInternetReachable: false,
  });
  
  const [connectionSpeed, setConnectionSpeed] = useState<'fast' | 'medium' | 'slow' | 'very_slow'>('medium');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkInfo({
        type: state.type as Network.NetworkStateType,
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
      });
      
      // Estimate connection speed based on network type
      if (state.type === 'wifi') {
        setConnectionSpeed('fast');
      } else if (state.type === 'cellular') {
        const details = state.details as any;
        if (details?.cellularGeneration === '4g') {
          setConnectionSpeed('medium');
        } else if (details?.cellularGeneration === '3g') {
          setConnectionSpeed('slow');
        } else {
          setConnectionSpeed('very_slow');
        }
      } else {
        setConnectionSpeed('slow');
      }
    });

    return () => unsubscribe();
  }, []);

  return { networkInfo, connectionSpeed };
}

// FIXED: Debounce utility function
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// --- Optimized Clip Item Component ---
interface ClipItemProps {
  item: AutoClip;
  index: number;
  handleVideoPress: (clipId: number) => void;
  handleDoubleTap: (clipId: number) => void;
  isPlaying: VideoState;
  currentVideoIndex: number;
  globalMute: boolean;
  videoLoading: { [key: number]: boolean };
  setVideoLoading: React.Dispatch<React.SetStateAction<{ [key: number]: boolean }>>;
  renderVideoControls: (clipId: number) => JSX.Element;
  renderClipInfo: (item: AutoClip) => JSX.Element;
  handlePlaybackStatusUpdate: (status: any, clipId: number) => void;
  allowPlayback: boolean;
  isDarkMode: boolean;
  videoRefs: React.MutableRefObject<{ [key: number]: React.RefObject<Video> }>;
  videoQuality: 'high' | 'medium' | 'low';
  savedPosition?: number;
}

const ClipItem = React.memo<ClipItemProps>(({
  item,
  index,
  handleVideoPress,
  handleDoubleTap,
  isPlaying,
  currentVideoIndex,
  globalMute,
  videoLoading,
  setVideoLoading,
  renderVideoControls,
  renderClipInfo,
  handlePlaybackStatusUpdate,
  isDarkMode,
  videoRefs,
  allowPlayback,
  videoQuality,
  savedPosition = 0,
}) => {
  const [iconVisible, setIconVisible] = useState(false);
  const [iconType, setIconType] = useState<"play" | "pause">("play");
  const [videoUri, setVideoUri] = useState<string>('');
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const cacheManager = VideoCacheManager.getInstance();
  
  // FIXED: Better refs management
  const initialPositionSet = useRef(false);
  const videoLoadedRef = useRef(false);
  const positionSetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // FIXED: Memoized shouldPlay calculation to prevent unnecessary changes
  const isCurrentlyVisible = index === currentVideoIndex;
  const shouldPlay = useMemo(() => {
    return isPlaying[item.id] === true && isCurrentlyVisible && allowPlayback;
  }, [isPlaying, item.id, isCurrentlyVisible, allowPlayback]);
  
  // FIXED: Debounce shouldPlay to prevent rapid changes
  const debouncedShouldPlay = useDebounce(shouldPlay, VIDEO_STATE_DEBOUNCE);
  
  // Get the appropriate video URL based on quality
  const getVideoUrl = useCallback(() => {
    switch (videoQuality) {
      case 'low':
        return item.video_url_low || item.video_url;
      case 'medium':
        return item.video_url_medium || item.video_url;
      default:
        return item.video_url;
    }
  }, [item, videoQuality]);

  // Load video with caching
  useEffect(() => {
    let isMounted = true;
    
    const loadVideo = async () => {
      const url = getVideoUrl();
      if (!url) return;
      
      try {
        const cachedUri = await cacheManager.getCachedVideoUri(url, videoQuality);
        
        if (isMounted) {
          setVideoUri(cachedUri);
        }
      } catch (err) {
        console.error('Error loading video:', err);
        if (isMounted) {
          setVideoUri(url); // Fallback to streaming
        }
      }
    };
    
    // Only load if close to current index
    if (Math.abs(index - currentVideoIndex) <= VIDEO_PRELOAD_BUFFER) {
      loadVideo();
    }
    
    return () => {
      isMounted = false;
    };
  }, [item, videoQuality, index, currentVideoIndex]);

  // FIXED: Reset refs when video changes or becomes invisible
  useEffect(() => {
    initialPositionSet.current = false;
    videoLoadedRef.current = false;
    
    // Clear position timeout if video changes
    if (positionSetTimeoutRef.current) {
      clearTimeout(positionSetTimeoutRef.current);
      positionSetTimeoutRef.current = null;
    }
  }, [item.id, isCurrentlyVisible]);

  // Ensure ref exists
  if (!videoRefs.current[item.id]) {
    videoRefs.current[item.id] = React.createRef();
  }

  const handlePress = () => {
    handleVideoPress(item.id);
    setIconVisible(true);
    setIconType(isPlaying[item.id] ? "play" : "pause");
    setTimeout(() => setIconVisible(false), 500);
  };

  // FIXED: Improved status update handler
  const handleStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsBuffering(status.isBuffering);
      
      // FIXED: Only set position when video is loaded, should be playing, and position hasn't been set yet
      if (!initialPositionSet.current && 
          savedPosition > 0 && 
          status.durationMillis && 
          debouncedShouldPlay && 
          videoLoadedRef.current) {
        
        // Clear any existing timeout
        if (positionSetTimeoutRef.current) {
          clearTimeout(positionSetTimeoutRef.current);
        }
        
        // Set position with delay to ensure video is ready
        positionSetTimeoutRef.current = setTimeout(() => {
          const videoRef = videoRefs.current[item.id]?.current;
          if (videoRef && !initialPositionSet.current) {
            videoRef.setPositionAsync(savedPosition * 1000)
              .then(() => {
                initialPositionSet.current = true;
              })
              .catch(console.error);
          }
        }, POSITION_SET_DELAY);
      }
    }
    
    // Always call the parent handler
    handlePlaybackStatusUpdate(status, item.id);
  }, [handlePlaybackStatusUpdate, item.id, savedPosition, debouncedShouldPlay]);

  // FIXED: Simplified load handler
  const handleLoad = useCallback(() => {
    setVideoLoading(prev => ({ ...prev, [item.id]: false }));
    setHasLoaded(true);
    videoLoadedRef.current = true;
    
    // No manual playback control - let shouldPlay handle everything
  }, [item.id]);

  // FIXED: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (positionSetTimeoutRef.current) {
        clearTimeout(positionSetTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={{ height, width }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        onLongPress={() => handleDoubleTap(item.id)}
        style={{ flex: 1 }}
      >
        {videoUri ? (
          <Video
            ref={videoRefs.current[item.id]}
            source={{ uri: videoUri }}
            style={{ flex: 1 }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={debouncedShouldPlay}
            isLooping
            isMuted={globalMute}
            onPlaybackStatusUpdate={handleStatusUpdate}
            progressUpdateIntervalMillis={250}
            onLoadStart={() => {
              if (!hasLoaded) {
                setVideoLoading(prev => ({ ...prev, [item.id]: true }));
              }
            }}
            onLoad={handleLoad}
            onError={(error) => {
              console.error("Video error:", error);
              setVideoLoading(prev => ({ ...prev, [item.id]: false }));
            }}
            rate={1.0}
            volume={1.0}
            shouldCorrectPitch={true}
            useNativeControls={false}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            {item.thumbnail_url && (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={{ flex: 1 }}
                contentFit="cover"
              />
            )}
          </View>
        )}

        {/* Play/Pause Icon Overlay */}
        {iconVisible && (
          <View style={styles.iconContainer}>
            <Ionicons
              name={iconType === "play" ? "play-circle" : "pause-circle"}
              size={60}
              color="white"
            />
          </View>
        )}

        {renderVideoControls(item.id)}
        {renderClipInfo(item)}
      </TouchableOpacity>
    </View>
  );
});

// --- Main AutoClips Component ---
export default function AutoClips() {
  const { isDarkMode } = useTheme();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { networkInfo, connectionSpeed } = useNetworkMonitor();
  
  // Parameters handling
  const localParams = useLocalSearchParams<{ clipId?: string, fromDeepLink?: string }>();
  const globalParams = useGlobalSearchParams();
  const clipId = localParams.clipId || globalParams.clipId;
  const fromDeepLink = localParams.fromDeepLink || globalParams.fromDeepLink;
  
  // State management
  const [autoClips, setAutoClips] = useState<AutoClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allowVideoPlayback, setAllowVideoPlayback] = useState(false);
  
  // Deep link state
  const [isNavigatingToDeepLink, setIsNavigatingToDeepLink] = useState(false);
  const [hasHandledDeepLink, setHasHandledDeepLink] = useState(false);
  const deepLinkHandled = useRef(false);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState<VideoState>({});
  const [globalMute, setGlobalMute] = useState(false);
  const [videoLoading, setVideoLoading] = useState<{ [key: number]: boolean }>({});
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [expandedDescriptions, setExpandedDescriptions] = useState<{ [key: number]: boolean }>({});
  
  // Video position tracking
  const [videoPositions, setVideoPositions] = useState<VideoPositions>({});
  const [videoDurations, setVideoDurations] = useState<{ [key: number]: number }>({});
  
  // Performance optimizations
  const [videoQuality, setVideoQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const hasInitialLoad = useRef(false);
  
  // FIXED: Add debounce refs
  const videoStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const viewabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: number]: React.RefObject<Video> }>({});
  const viewTimers = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const lastTap = useRef<{ [key: number]: number }>({});
  const viewedClips = useRef<Set<number>>(new Set());
  const appStateRef = useRef(AppState.currentState);

  // Adjust video quality based on connection speed
  useEffect(() => {
    switch (connectionSpeed) {
      case 'fast':
        setVideoQuality('high');
        break;
      case 'medium':
        setVideoQuality('medium');
        break;
      case 'slow':
      case 'very_slow':
        setVideoQuality('low');
        break;
    }
  }, [connectionSpeed]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        // App going to background - pause all videos but maintain positions
        setIsPlaying({});
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Deep link handling
  useEffect(() => {
    if (clipId && !isLoading && autoClips.length > 0 && !hasHandledDeepLink && !deepLinkHandled.current) {
      const targetClipIndex = autoClips.findIndex(
        clip => clip.id.toString() === clipId.toString()
      );
      
      if (targetClipIndex !== -1) {
        setIsNavigatingToDeepLink(true);
        setHasHandledDeepLink(true);
        deepLinkHandled.current = true;
        
        // Stop all currently playing videos
        setIsPlaying({});
        
        // Navigate to clip
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: targetClipIndex,
            animated: false,
          });
          setCurrentVideoIndex(targetClipIndex);
          
          if (fromDeepLink === 'true') {
            setAllowVideoPlayback(true);
          }
          
          setTimeout(() => {
            setIsNavigatingToDeepLink(false);
          }, 1000);
        }, 500);
      } else {
        Alert.alert('Clip Not Found', 'The requested video is no longer available.');
        setHasHandledDeepLink(true);
        deepLinkHandled.current = true;
      }
    }
  }, [clipId, fromDeepLink, isLoading, autoClips, hasHandledDeepLink]);

  useEffect(() => {
    if (clipId && deepLinkHandled.current) {
      // Reset the deep link handling state when navigating to a different clip
      setHasHandledDeepLink(false);
      deepLinkHandled.current = false;
    }
  }, [clipId]);

  // Focus handling
  useEffect(() => {
    setAllowVideoPlayback(isFocused);
    
    if (!isFocused) {
      // Pause videos when not focused but maintain positions
      setIsPlaying({});
    }
  }, [isFocused]);

  // Track clip view
  const trackClipView = useCallback(async (clipId: number) => {
    if (!user || viewedClips.current.has(clipId)) return;
    
    try {
      await supabase.rpc("track_autoclip_view", {
        clip_id: clipId,
        user_id: user.id,
      });
      viewedClips.current.add(clipId);
      setAutoClips(prev =>
        prev.map(clip =>
          clip.id === clipId
            ? { ...clip, views: (clip.views || 0) + 1 }
            : clip
        )
      );
    } catch (err) {
      console.error("Error tracking view:", err);
    }
  }, [user]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!networkInfo.isConnected) {
      setError('No internet connection');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: clipsData, error: clipsError } = await supabase
        .from("auto_clips")
        .select("*,liked_users")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (clipsError) throw clipsError;

      const carIds = clipsData?.map(clip => clip.car_id) || [];
      const dealershipIds = clipsData?.map(clip => clip.dealership_id) || [];

      const [carsResponse, dealershipsResponse] = await Promise.all([
        supabase.from("cars").select("*").in("id", carIds),
        supabase.from("dealerships").select("*").in("id", dealershipIds),
      ]);

      const carsById = (carsResponse.data || []).reduce(
        (acc, car) => ({ ...acc, [car.id]: car }),
        {}
      );
      
      const dealershipsById = (dealershipsResponse.data || []).reduce(
        (acc, dealer) => ({ ...acc, [dealer.id]: dealer }),
        {}
      );

      const mergedClips = (clipsData || []).map(clip => ({
        ...clip,
        car: carsById[clip.car_id],
        dealership: dealershipsById[clip.dealership_id],
        liked_users: clip.liked_users || [],
      }));

      setAutoClips(mergedClips);
      
      // Only set initial playing state on first load
      if (!hasInitialLoad.current) {
        setIsPlaying(
          mergedClips.reduce(
            (acc, clip, index) => ({ ...acc, [clip.id]: index === 0 }),
            {}
          )
        );
        hasInitialLoad.current = true;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load content");
    } finally {
      setIsLoading(false);
    }
  }, [networkInfo.isConnected]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setHasHandledDeepLink(false);
    deepLinkHandled.current = false;
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Video playback handlers
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus, clipId: number) => {
    if (status.isLoaded) {
      // Update position
      setVideoPositions(prev => ({
        ...prev,
        [clipId]: status.positionMillis / 1000,
      }));
      
      // Update duration
      if (status.durationMillis) {
        setVideoDurations(prev => ({
          ...prev,
          [clipId]: status.durationMillis / 1000,
        }));
      }
    }
  }, []);

  // FIXED: Debounced video press handler
  const handleVideoPress = useCallback((clipId: number) => {
    // Clear any existing timeout
    if (videoStateTimeoutRef.current) {
      clearTimeout(videoStateTimeoutRef.current);
    }
    
    // Debounce the state change
    videoStateTimeoutRef.current = setTimeout(() => {
      const newPlayingState = !isPlaying[clipId];
      setIsPlaying(prev => ({ ...prev, [clipId]: newPlayingState }));
      
      if (newPlayingState) {
        viewTimers.current[currentVideoIndex] = setTimeout(() => {
          trackClipView(clipId);
        }, 5000);
      } else {
        if (viewTimers.current[currentVideoIndex]) {
          clearTimeout(viewTimers.current[currentVideoIndex]);
        }
      }
    }, VIDEO_STATE_DEBOUNCE);
  }, [isPlaying, currentVideoIndex, trackClipView]);

  const handleLikePress = useCallback(async (clipId: number) => {
    if (!user) return;
    
    try {
      const { data: newLikesCount, error } = await supabase.rpc(
        "toggle_autoclip_like",
        {
          clip_id: clipId,
          user_id: user.id,
        }
      );
      
      if (error) throw error;
      
      setAutoClips(prev =>
        prev.map(clip => {
          if (clip.id === clipId) {
            const isCurrentlyLiked = clip.liked_users?.includes(user.id);
            const updatedLikedUsers = isCurrentlyLiked
              ? clip.liked_users.filter(id => id !== user.id)
              : [...(clip.liked_users || []), user.id];
            return {
              ...clip,
              likes: newLikesCount,
              liked_users: updatedLikedUsers,
            };
          }
          return clip;
        })
      );
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  }, [user]);

  const handleMutePress = useCallback(async (clipId: number, event: any) => {
    event.stopPropagation();
    const newMuteState = !globalMute;
    setGlobalMute(newMuteState);
    
    // Apply to all videos
    await Promise.all(
      Object.values(videoRefs.current).map(ref =>
        ref?.current?.setIsMutedAsync(newMuteState).catch(() => {})
      )
    );
  }, [globalMute]);

  const handleDoubleTap = useCallback(async (clipId: number) => {
    const now = Date.now();
    const lastTapTime = lastTap.current[clipId] || 0;
    
    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      const clip = autoClips.find(c => c.id === clipId);
      if (clip && !clip.liked_users?.includes(user?.id || "")) {
        await handleLikePress(clipId);
      }
    }
    
    lastTap.current[clipId] = now;
  }, [autoClips, handleLikePress, user?.id]);

  const handleVideoScrub = useCallback(async (clipId: number, time: number) => {
    const videoRef = videoRefs.current[clipId]?.current;
    if (videoRef) {
      try {
        await videoRef.setPositionAsync(time * 1000);
        // Update position state immediately for smooth UI
        setVideoPositions(prev => ({ ...prev, [clipId]: time }));
      } catch (err) {
        console.error("Error scrubbing video:", err);
      }
    }
  }, []);

  // Render helpers
  const renderVideoControls = useCallback((clipId: number) => {
    const clip = autoClips.find(c => c.id === clipId);
    const isLiked = clip?.liked_users?.includes(user?.id || "") || false;
    
    return (
      <VideoControls
        clipId={clipId}
        duration={videoDurations[clipId] || 0}
        currentTime={videoPositions[clipId] || 0}
        isPlaying={isPlaying[clipId]}
        globalMute={globalMute}
        onMutePress={handleMutePress}
        onScrub={handleVideoScrub}
        videoRef={videoRefs}
        likes={clip?.likes || 0}
        isLiked={isLiked}
        onLikePress={handleLikePress}
      />
    );
  }, [
    autoClips,
    videoDurations,
    videoPositions,
    isPlaying,
    globalMute,
    user?.id,
    handleMutePress,
    handleVideoScrub,
    handleLikePress,
  ]);

  const renderClipInfo = useMemo(() => (item: AutoClip) => {
    const formattedPostDate = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
    const isDescriptionExpanded = expandedDescriptions[item.id] || false;
    const shouldShowExpandOption = item.description && item.description.length > 80;

    return (
      <View style={styles.clipInfoContainer}>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.9)"]}
          style={styles.clipInfoGradient}
        >
          <View style={styles.dealershipRow}>
            <View style={styles.dealershipInfo}>
              {item.dealership?.logo && (
                <Image
                  source={{ uri: item.dealership.logo }}
                  style={styles.dealershipLogo}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.dealershipName}>
                  {item.dealership?.name}
                </Text>
                <Text style={styles.postDate}>
                  {formattedPostDate}
                </Text>
              </View>
            </View>
          </View>

          {item.car && (
            <View style={{ marginBottom: 4 }}>
              <Text style={styles.carTitle}>
                {item.car.year} {item.car.make} {item.car.model}
              </Text>
            </View>
          )}

          {item.description && (
            <View style={{ marginBottom: 4 }}>
              <TouchableOpacity
                onPress={() => {
                  setExpandedDescriptions(prev => ({
                    ...prev,
                    [item.id]: !prev[item.id],
                  }));
                }}
                activeOpacity={0.9}
              >
                <Text
                  style={styles.description}
                  numberOfLines={isDescriptionExpanded ? undefined : 2}
                >
                  {item.description}
                  {shouldShowExpandOption && (
                    <Text style={styles.readMore}>
                      {" "}
                      {isDescriptionExpanded ? "Read less" : "... Read more"}
                    </Text>
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {item.car && (
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => {
                  router.push({
                    pathname: "/(home)/(user)/CarDetails",
                    params: { carId: item.car.id },
                  });
                }}
              >
                <Text style={styles.viewDetailsText}>View Details</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  if (item.dealership?.phone) {
                    Linking.openURL(`tel:${item.dealership.phone}`);
                  } else {
                    Alert.alert("Contact", "Phone number not available");
                  }
                }}
              >
                <Ionicons name="call-outline" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  if (item.dealership?.phone) {
                    const message = `Hi, I'm interested in the ${item.car.year} ${item.car.make} ${item.car.model}`;
                    openWhatsApp(item.dealership.phone, message);
                  } else {
                    Alert.alert("Contact", "Phone number not available");
                  }
                }}
              >
                <Ionicons name="logo-whatsapp" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  if (!item.car) return;
                  shareAutoclip(item);
                }}
              >
                <Ionicons name="share-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  }, [expandedDescriptions]);

  // FIXED: Heavily optimized viewability handler with debouncing
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (isNavigatingToDeepLink || viewableItems.length === 0) return;
    
    // Clear existing timeout
    if (viewabilityTimeoutRef.current) {
      clearTimeout(viewabilityTimeoutRef.current);
    }
    
    // Debounce viewability changes
    viewabilityTimeoutRef.current = setTimeout(() => {
      const visibleClip = viewableItems[0].item;
      const newIndex = autoClips.findIndex(clip => clip.id === visibleClip.id);
      
      if (newIndex !== currentVideoIndex && newIndex !== -1) {
        // Clear existing view timer
        if (viewTimers.current[currentVideoIndex]) {
          clearTimeout(viewTimers.current[currentVideoIndex]);
        }
        
        setCurrentVideoIndex(newIndex);
        
        // Start new view timer
        viewTimers.current[newIndex] = setTimeout(() => {
          trackClipView(visibleClip.id);
        }, 5000);
        
        // FIXED: Simplified state update - only change playing state
        setIsPlaying(prev => {
          const newState: VideoState = {};
          // Only the visible video should be playing
          newState[visibleClip.id] = allowVideoPlayback;
          return newState;
        });
      }
    }, 150); // Debounce viewability changes
  }, [autoClips, currentVideoIndex, trackClipView, allowVideoPlayback, isNavigatingToDeepLink]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    waitForInteraction: false,
    minimumViewTime: 300,
  }), []);

  // FIXED: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoStateTimeoutRef.current) {
        clearTimeout(videoStateTimeoutRef.current);
      }
      if (viewabilityTimeoutRef.current) {
        clearTimeout(viewabilityTimeoutRef.current);
      }
    };
  }, []);

  // Error state
  if (error && !networkInfo.isConnected) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="wifi-outline" size={64} color={isDarkMode ? "#fff" : "#000"} />
        <Text style={[styles.errorText, { color: isDarkMode ? "#fff" : "#000" }]}>
          No Internet Connection
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading state
  if (isLoading && autoClips.length === 0) {
    return (
      <SplashScreen
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        onSplashFinish={() => setAllowVideoPlayback(true)}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? "black" : "white" }]}>
      <TouchableOpacity style={styles.homeButton} onPress={() => router.back()}>
        <Ionicons name="home" size={24} color="white" />
      </TouchableOpacity>

      {/* Network quality indicator */}
      {networkInfo.isConnected && connectionSpeed !== 'fast' && (
        <View style={styles.networkIndicator}>
          <Ionicons 
            name="wifi-outline" 
            size={16} 
            color={connectionSpeed === 'very_slow' ? '#ff4444' : '#ffaa00'} 
          />
          <Text style={styles.networkText}>
            {connectionSpeed === 'very_slow' ? 'Slow Connection' : 'Limited Connection'}
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={autoClips}
        renderItem={({ item, index }) => (
          <ClipItem
            item={item}
            index={index}
            handleVideoPress={handleVideoPress}
            handleDoubleTap={handleDoubleTap}
            isPlaying={isPlaying}
            currentVideoIndex={currentVideoIndex}
            globalMute={globalMute}
            videoLoading={videoLoading}
            setVideoLoading={setVideoLoading}
            renderVideoControls={renderVideoControls}
            renderClipInfo={renderClipInfo}
            handlePlaybackStatusUpdate={handlePlaybackStatusUpdate}
            isDarkMode={isDarkMode}
            videoRefs={videoRefs}
            allowPlayback={allowVideoPlayback}
            videoQuality={videoQuality}
            savedPosition={videoPositions[item.id] || 0}
          />
        )}
        keyExtractor={item => item.id.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? "#FFFFFF" : "#D55004"}
          />
        }
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}
        removeClippedSubviews
        maxToRenderPerBatch={2}
        windowSize={5}
        initialNumToRender={1}
        updateCellsBatchingPeriod={100}
        getItemLayout={(data, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
      />
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#D55004",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  homeButton: {
    position: "absolute",
    top: 48,
    left: 16,
    zIndex: 50,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 9999,
    elevation: 5,
  },
  networkIndicator: {
    position: "absolute",
    top: 48,
    right: 16,
    zIndex: 50,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  networkText: {
    color: "white",
    fontSize: 12,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bufferingText: {
    color: "white",
    marginTop: 8,
    fontSize: 14,
  },
  iconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  clipInfoContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 0,
    height: "auto",
  },
  clipInfoGradient: {
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingBottom: 60,
    marginBottom: 0,
    zIndex: 50,
  },
  dealershipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  dealershipInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dealershipLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dealershipName: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  postDate: {
    color: "#A8A8A8",
    fontSize: 12,
  },
  carTitle: {
    color: "#D55004",
    fontSize: 20,
    fontWeight: "bold",
  },
  description: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    lineHeight: 24,
  },
  readMore: {
    color: "#D55004",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewDetailsButton: {
    flex: 1,
    backgroundColor: "#D55004",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  viewDetailsText: {
    color: "white",
    fontWeight: "600",
    marginRight: 8,
  },
  actionButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
});