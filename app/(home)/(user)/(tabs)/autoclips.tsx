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
  Share,
  Linking,
  ActivityIndicator,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useTheme } from "@/utils/ThemeContext";
import VideoControls from "@/components/VideoControls";
import { supabase } from "@/utils/supabase";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "@/utils/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, Pause, Play } from "lucide-react-native";
import { router } from "expo-router";
import * as Network from "expo-network";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import SplashScreen from "../SplashScreen";
import { Ionicons } from "@expo/vector-icons";
import openWhatsApp from "@/utils/openWhatsapp";
import { shareContent } from "@/utils/shareUtils";
import { useLocalSearchParams } from 'expo-router';

// --- constants ---
const { height, width } = Dimensions.get("window");
const DOUBLE_TAP_DELAY = 300;
const TAB_BAR_HEIGHT = 80;
const MAX_VIDEO_BUFFER = 2; // we now preload only a couple of clips
const AVG_VIDEO_CHUNK_SIZE_BYTES = 9 * 1024 * 1024; // e.g., 5MB

// Adjust these to taste for your "splashes"
const SPLASH_CIRCLE_SIZE = width * 2;
const SPLASH_ANIM_DURATION = 500;
const TEXT_FADE_IN_DURATION = 500;
const EXIT_FADE_OUT_DURATION = 600;

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

/**
 * Helper: Given a remote video URL, check if it’s cached locally.
 * If not, download it into FileSystem.cacheDirectory.
 */
async function getCachedVideoUri(videoUrl: string): Promise<string> {
  const filename = encodeURIComponent(videoUrl.split("/").pop() || videoUrl);
  const localUri = FileSystem.cacheDirectory + filename;
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (fileInfo.exists) {
    return localUri;
  }
  try {
    const { uri } = await FileSystem.downloadAsync(videoUrl, localUri);
    return uri;
  } catch (err) {
    console.error("Error caching video:", err);
    return videoUrl; // fallback to remote URL
  }
}

/**
 * Custom hook that returns a cached URI.
 */
function useCachedVideoUri(videoUrl: string): string {
  const [uri, setUri] = useState(videoUrl);
  useEffect(() => {
    let isMounted = true;
    getCachedVideoUri(videoUrl)
      .then((cachedUri) => {
        if (isMounted) setUri(cachedUri);
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setUri(videoUrl);
      });
    return () => {
      isMounted = false;
    };
  }, [videoUrl]);
  return uri;
}

interface ClipItemProps {
  item: AutoClip;
  index: number;
  handleVideoPress: (clipId: number) => void;
  handleDoubleTap: (clipId: number) => void;
  isPlaying: VideoState;
  currentVideoIndex: number;
  globalMute: boolean;
  networkType: Network.NetworkStateType | null;
  videoLoading: { [key: number]: boolean };
  setVideoLoading: React.Dispatch<
    React.SetStateAction<{ [key: number]: boolean }>
  >;
  renderVideoControls: (clipId: number) => JSX.Element;
  renderClipInfo: (item: AutoClip) => JSX.Element;
  handlePlaybackStatusUpdate: (status: any, clipId: number) => void;
  allowPlayback: boolean;
  isDarkMode: boolean;
  videoRefs: React.MutableRefObject<{ [key: number]: React.RefObject<Video> }>;
}

const ClipItem: React.FC<ClipItemProps> = (props) => {
  const {
    item,
    index,
    handleVideoPress,
    handleDoubleTap,
    isPlaying,
    currentVideoIndex,
    globalMute,
    networkType,
    videoLoading,
    setVideoLoading,
    renderVideoControls,
    renderClipInfo,
    handlePlaybackStatusUpdate,
    isDarkMode,
    videoRefs,
    allowPlayback,
  } = props;

  // State to manage icon visibility
  const [iconVisible, setIconVisible] = React.useState(false);
  const [iconType, setIconType] = React.useState<"play" | "pause">("play"); // Default to play icon

  // Use the custom hook at the top level of this component.
  const cachedUri = useCachedVideoUri(item.video_url);

  // Ensure a ref exists for this clip.
  if (!videoRefs.current[item.id]) {
    videoRefs.current[item.id] = React.createRef();
  }

  const handlePress = () => {
    handleVideoPress(item.id);
    setIconVisible(true);
    if (isPlaying[item.id]) {
      setIconType("play");
    } else {
      setIconType("pause");
    }
    setTimeout(() => {
      setIconVisible(false);
    }, 500); // Icon disappears after 500ms
  };

  return (
    <View style={{ height, width }} key={`clip-${item.id}`}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        onLongPress={() => handleDoubleTap(item.id)}
        style={{ flex: 1 }}
      >
        <Video
          ref={videoRefs.current[item.id]}
          source={{ uri: cachedUri }}
          style={{ flex: 1 }}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isPlaying[item.id] && index === currentVideoIndex}
          isLooping
          isMuted={globalMute}
          onPlaybackStatusUpdate={(status) =>
            handlePlaybackStatusUpdate(status, item.id)
          }
          progressUpdateIntervalMillis={
            networkType === Network.NetworkStateType.CELLULAR ? 1000 : 250
          }
          onLoadStart={() => {
            setVideoLoading((prev) => ({ ...prev, [item.id]: true }));
          }}
          onLoad={async () => {
            setVideoLoading((prev) => ({ ...prev, [item.id]: false }));
            if (index === currentVideoIndex) {
              try {
                const ref = videoRefs.current[item.id]?.current;

                if (ref && isPlaying[item.id] && allowPlayback) {
                  await ref.playAsync();
                }
              } catch (err) {
                console.error("Error playing video on load:", err);
              }
            }
          }}
          rate={1.0}
          volume={1.0}
        />

        {/* Play/Pause Icon Overlay */}
        {iconVisible && (
          <View style={styles.iconContainer}>
            <Ionicons // Using Ionicons from expo-vector-icons
              name={iconType === "play" ? "play-circle" : "pause-circle"}
              size={60}
              color="white"
            />
          </View>
        )}

        {/* Blur loader while the video is loading */}
        {videoLoading[item.id] && (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={60}
            tint={isDarkMode ? "dark" : "light"}
          >
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="small" color="#D55004" />
            </View>
          </BlurView>
        )}

        {/* Video controls (e.g., play/pause overlay) */}
        {renderVideoControls(item.id)}

        {/* Info overlay with clip details */}
        {renderClipInfo(item)}
      </TouchableOpacity>
    </View>
  );
};

export default function AutoClips() {
  const { isDarkMode } = useTheme();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ clipId?: string, fromDeepLink?: string }>();
  const [autoClips, setAutoClips] = useState<AutoClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  

useEffect(() => {
  if (params.clipId && !isLoading && autoClips.length > 0) {
    const targetClipIndex = autoClips.findIndex(
      clip => clip.id.toString() === params.clipId
    );
    
    if (targetClipIndex !== -1) {
      // Add a ref to track if FlatList is ready
      let mounted = true;
      let attempts = 0;
      const maxAttempts = 10;
      
      const tryScrollToIndex = () => {
        if (!mounted) return;
        
        if (flatListRef.current) {
          try {
            flatListRef.current.scrollToIndex({
              index: targetClipIndex,
              animated: false,
            });
            
            setCurrentVideoIndex(targetClipIndex);
            if (params.fromDeepLink === 'true') {
              setAllowVideoPlayback(true);
            }
          } catch (error) {
            // FlatList not ready, retry if under max attempts
            if (attempts < maxAttempts) {
              attempts++;
              setTimeout(tryScrollToIndex, 100);
            } else {
              console.error('Failed to scroll to clip after max attempts');
            }
          }
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryScrollToIndex, 100);
        }
      };
      
      // Initial delay to ensure component mounting
      setTimeout(tryScrollToIndex, 500);
      
      return () => {
        mounted = false;
      };
    } else {
      Alert.alert('Clip Not Found', 'The requested video is no longer available.');
    }
  }
}, [params.clipId, isLoading, autoClips]);

const [allowVideoPlayback, setAllowVideoPlayback] = useState(() => {
  return params.fromDeepLink === 'true' ? false : false;
});

  // SPLASH SCREEN & LOADING STATES
  const [showSplash, setShowSplash] = useState(true);
  const [splashPhase, setSplashPhase] = useState<
    "entrance" | "holding" | "exit"
  >("entrance");
 
  const [error, setError] = useState<string | null>(null);
  const circleScales = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const circleOpacities = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];
  const splashTextOpacity = useRef(new Animated.Value(0)).current;
  const splashContainerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (params.fromDeepLink === 'true' && !showSplash) {
      setAllowVideoPlayback(true);
    }
  }, [params.fromDeepLink, showSplash]);

  useEffect(() => {
    setAllowVideoPlayback(isFocused);
  }, [isFocused]);

  useEffect(() => {
    if (splashPhase === "entrance") {
      Animated.sequence([
        Animated.timing(circleScales[0], {
          toValue: 1,
          duration: SPLASH_ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(circleScales[1], {
          toValue: 1,
          duration: SPLASH_ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(circleScales[2], {
          toValue: 1,
          duration: SPLASH_ANIM_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(splashTextOpacity, {
          toValue: 1,
          duration: TEXT_FADE_IN_DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSplashPhase("holding");
      });
    }
  }, [splashPhase]);


useEffect(() => {
  if (params.clipId && !isLoading && autoClips.length > 0) {
    const targetClip = autoClips.find(
      clip => clip.id.toString() === params.clipId
    );
    
    if (!targetClip) {
      // Log error for debugging
      console.error(`Deep link clip ${params.clipId} not found`);
      
      // Show user-friendly error
      Alert.alert(
        'Clip Not Found',
        'The requested video is no longer available.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to home or fallback
              router.replace('/(home)/(user)');
            }
          }
        ]
      );
    }
  }
}, [params.clipId, isLoading, autoClips]);

useEffect(() => {
  if (splashPhase === "holding" && !isLoading) {
    // If deep link, ensure proper exit timing
    const exitDelay = params.fromDeepLink === 'true' ? 300 : 0;
    
    setTimeout(() => {
      setSplashPhase("exit");
      Animated.timing(splashContainerOpacity, {
        toValue: 0,
        duration: EXIT_FADE_OUT_DURATION,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
        
        // For deep links, ensure playback starts after splash is fully hidden
        if (params.fromDeepLink === 'true') {
          setAllowVideoPlayback(true);
        }
      });
    }, exitDelay);
  }
}, [splashPhase, isLoading, params.fromDeepLink]);

  // NETWORK, DATA, VIDEO STATES
  const [refreshing, setRefreshing] = useState(false);
  const [networkType, setNetworkType] =
    useState<Network.NetworkStateType | null>(null);

  const viewedClips = useRef<Set<number>>(new Set());
  const [expandedDescriptions, setExpandedDescriptions] = useState<{
    [key: number]: boolean;
  }>({});
  const [isPlaying, setIsPlaying] = useState<VideoState>({});
  const [globalMute, setGlobalMute] = useState(false);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<VideoState>({});
  const [videoLoading, setVideoLoading] = useState<{ [key: number]: boolean }>(
    {}
  );

  // Timers/refs
  const viewTimers = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const lastTap = useRef<{ [key: number]: number }>({});
  const flatListRef = useRef<FlatList>(null);
  const heartAnimations = useRef<{ [key: number]: Animated.Value }>({});
  const playPauseAnimations = useRef<{ [key: number]: Animated.Value }>({});
  const videoRefs = useRef<{ [key: number]: React.RefObject<Video> }>({});
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    waitForInteraction: true,
    minimumViewTime: 500,
  }).current;

  const [videoProgress, setVideoProgress] = useState<{ [key: number]: number }>(
    {}
  );
  const [videoDuration, setVideoDuration] = useState<{ [key: number]: number }>(
    {}
  );

  // FETCH / DATA LOGIC
  const initializeClipAnimations = useCallback((clipId: number) => {
    heartAnimations.current[clipId] = new Animated.Value(0);
    playPauseAnimations.current[clipId] = new Animated.Value(0);
  }, []);

  useEffect(() => {
    if (allowVideoPlayback && autoClips.length > 0) {
      const currentClip = autoClips[currentVideoIndex];
      if (currentClip) {
        const ref = videoRefs.current[currentClip.id];
        if (ref && ref.current) {
          ref.current.playAsync();
          setIsPlaying((prev) => ({ ...prev, [currentClip.id]: true }));
        }
      }
    }
  }, [allowVideoPlayback, currentVideoIndex, autoClips]);
  const trackClipView = useCallback(
    async (clipId: number) => {
      if (!user || viewedClips.current.has(clipId)) return;
      try {
        await supabase.rpc("track_autoclip_view", {
          clip_id: clipId,
          user_id: user.id,
        });
        viewedClips.current.add(clipId);
        setAutoClips((prev) =>
          prev.map((clip) =>
            clip.id === clipId
              ? { ...clip, views: (clip.views || 0) + 1 }
              : clip
          )
        );
      } catch (err) {
        console.error("Error tracking view:", err);
      }
    },
    [user]
  );

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: clipsData, error: clipsError } = await supabase
        .from("auto_clips")
        .select("*,liked_users")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (clipsError) throw clipsError;

      const carIds = clipsData?.map((clip) => clip.car_id) || [];
      const dealershipIds = clipsData?.map((clip) => clip.dealership_id) || [];

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

      const mergedClips = (clipsData || []).map((clip) => {
        initializeClipAnimations(clip.id);
        return {
          ...clip,
          car: carsById[clip.car_id],
          dealership: dealershipsById[clip.dealership_id],
          liked_users: clip.liked_users || [],
        };
      });

      setAutoClips(mergedClips);
      setIsPlaying(
        mergedClips.reduce(
          (acc, clip, index) => ({ ...acc, [clip.id]: index === 0 }),
          {}
        )
      );
    } catch (err: any) {
      setError(err?.message || "Failed to load content");
    } finally {
      setIsLoading(false);
    }
  }, [initializeClipAnimations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handlePlaybackStatusUpdate = useCallback(
    (status: any, clipId: number) => {
      if (status.isLoaded) {
        setVideoProgress((prev) => ({
          ...prev,
          [clipId]: status.positionMillis / 1000,
        }));
        setVideoDuration((prev) => ({
          ...prev,
          [clipId]: status.durationMillis / 1000,
        }));
        if (
          status.didJustFinish &&
          !status.isLooping &&
          currentVideoIndex < autoClips.length - 1
        ) {
          flatListRef.current?.scrollToIndex({
            index: currentVideoIndex + 1,
            animated: true,
          });
        }
      }
    },
    [currentVideoIndex, autoClips.length]
  );

  const handleVideoScrub = useCallback(async (clipId: number, time: number) => {
    const videoRef = videoRefs.current[clipId]?.current;
    if (videoRef) {
      try {
        await videoRef.setPositionAsync(time * 1000);
      } catch (err) {
        console.error("Error scrubbing video:", err);
      }
    }
  }, []);

  // Check network type
  useEffect(() => {
    const getType = async () => {
      const type: any = await Network.getNetworkStateAsync();
      setNetworkType(type.type);
    };
    getType();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(viewTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData, user]);

  // Pause videos when not focused
  useEffect(() => {
    // When focus changes but component remains mounted
    if (!isFocused) {
      // Handle with Promise.all for proper async operation
      Promise.all(
        Object.values(videoRefs.current).map(async (ref) => {
          if (!ref?.current) return;
          try {
            await ref.current.pauseAsync();
            await ref.current.setPositionAsync(0);
          } catch (err) {
            console.log("Video reset operation:", err);
          }
        })
      ).catch((err) => console.error("Error during video reset:", err));

      setVideoProgress({});
      setVideoDuration({});
    }

    // When unmounting - only pause videos, don't attempt to seek
    return () => {
      // We can't use await in cleanup, so handle each individually
      Object.values(videoRefs.current).forEach((ref) => {
        if (ref?.current) {
          // Only pause, don't seek position during unmount
          ref.current.pauseAsync().catch(() => {});
        }
      });

      setVideoProgress({});
      setVideoDuration({});
    };
  }, [isFocused]);

  // VIDEO TAP / LIKE / MUTE LOGIC
  const handleVideoPress = useCallback(
    async (clipId: number) => {
      const videoRef = videoRefs.current[clipId]?.current;
      if (!videoRef) return;
      const newPlayingState = !isPlaying[clipId];
      setIsPlaying((prev) => ({ ...prev, [clipId]: newPlayingState }));
      try {
        if (newPlayingState) {
          await videoRef.playAsync();
          viewTimers.current[currentVideoIndex] = setTimeout(() => {
            trackClipView(clipId);
          }, 5000);
        } else {
          await videoRef.pauseAsync();
          if (viewTimers.current[currentVideoIndex]) {
            clearTimeout(viewTimers.current[currentVideoIndex]);
          }
        }
        const animation = playPauseAnimations.current[clipId];
        setShowPlayPauseIcon((prev) => ({ ...prev, [clipId]: true }));
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(animation, {
            toValue: 0,
            duration: 200,
            delay: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowPlayPauseIcon((prev) => ({ ...prev, [clipId]: false }));
        });
      } catch (err) {
        console.error("Error handling video playback:", err);
      }
    },
    [currentVideoIndex, isPlaying, trackClipView]
  );

  const handleLikePress = useCallback(
    async (clipId: number) => {
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
        setAutoClips((prev) =>
          prev.map((clip) => {
            if (clip.id === clipId) {
              const isCurrentlyLiked = clip.liked_users?.includes(user.id);
              const updatedLikedUsers = isCurrentlyLiked
                ? clip.liked_users.filter((id) => id !== user.id)
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
        const animation = heartAnimations.current[clipId];
        if (animation) {
          animation.setValue(0);
          Animated.sequence([
            Animated.spring(animation, {
              toValue: 1,
              useNativeDriver: true,
              damping: 15,
            }),
            Animated.timing(animation, {
              toValue: 0,
              duration: 100,
              delay: 500,
              useNativeDriver: true,
            }),
          ]).start();
        }
      } catch (err) {
        console.error("Error toggling like:", err);
      }
    },
    [user]
  );

  const handleMutePress = useCallback(
    async (clipId: number, event: any) => {
      event.stopPropagation();
      const newMuteState = !globalMute;
      setGlobalMute(newMuteState);
      Object.values(videoRefs.current).forEach((ref) => {
        ref?.current?.setIsMutedAsync(newMuteState);
      });
    },
    [globalMute]
  );

  const handleDoubleTap = useCallback(
    async (clipId: number) => {
      const now = Date.now();
      const lastTapTime = lastTap.current[clipId] || 0;
      if (now - lastTapTime < DOUBLE_TAP_DELAY) {
        const clip = autoClips.find((c) => c.id === clipId);
        if (clip && !clip.liked_users?.includes(user?.id || "")) {
          await handleLikePress(clipId);
        }
      }
      lastTap.current[clipId] = now;
    },
    [autoClips, handleLikePress, user?.id]
  );

  // RENDER HELPERS
  const renderVideoControls = useCallback(
    (clipId: number) => {
      const clip = autoClips.find((c) => c.id === clipId);
      const isLiked = clip?.liked_users?.includes(user?.id || "") || false;
      return (
        <VideoControls
          clipId={clipId}
          duration={videoDuration[clipId] || 0}
          currentTime={videoProgress[clipId] || 0}
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
    },
    [
      autoClips,
      videoDuration,
      videoProgress,
      isPlaying,
      globalMute,
      user?.id,
      handleMutePress,
      handleVideoScrub,
      handleLikePress,
    ]
  );

  const getFormattedPostDate = useCallback((createdAt: any) => {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  }, []);

  const renderClipInfo = useMemo(
    () => (item: AutoClip) => {
      const formattedPostDate = getFormattedPostDate(item.created_at);
      const isDescriptionExpanded = expandedDescriptions[item.id] || false;
      const shouldShowExpandOption =
        item.description && item.description.length > 80;

      return (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 0,
            height: "auto", // ADD this to allow content to determine height
          }}
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.9)"]}
            style={{
              padding: 20,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingBottom: 60, // INCREASE from 60 to 80
              marginBottom: 0, // CHANGE from 10 to 0
              zIndex: 50, // RESTORE from 10 to 50
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                {item.dealership?.logo && (
                  <Image
                    source={{ uri: item.dealership.logo }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      marginRight: 12,
                      backgroundColor: "rgba(255,255,255,0.5)",
                    }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: "white",
                      fontSize: 18,
                      fontWeight: "bold",
                    }}
                  >
                    {item.dealership?.name}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: "#A8A8A8", fontSize: 12 }}>
                      {formattedPostDate}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {item.car && (
              <View style={{ marginBottom: 4 }}>
                <Text
                  style={{ color: "#D55004", fontSize: 20, fontWeight: "bold" }}
                >
                  {item.car.year} {item.car.make} {item.car.model}
                </Text>
              </View>
            )}

            {item.description && (
              <View style={{ marginBottom: 4 }}>
                <TouchableOpacity
                  onPress={() => {
                    setExpandedDescriptions((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }));
                  }}
                  activeOpacity={0.9}
                >
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 16,
                      lineHeight: 24,
                    }}
                    numberOfLines={isDescriptionExpanded ? undefined : 2}
                  >
                    {item.description}
                    {shouldShowExpandOption && (
                      <Text style={{ color: "#D55004" }}>
                        {" "}
                        {isDescriptionExpanded ? "Read less" : "... Read more"}
                      </Text>
                    )}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {item.car && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: "#D55004",
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={() => {
                    router.push({
                      pathname: "/(home)/(user)/CarDetails",
                      params: { carId: item.car.id },
                    });
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontWeight: "600",
                      marginRight: 8,
                    }}
                  >
                    View Details
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="white" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    padding: 8,
                    borderRadius: 10,
                    marginLeft: 20,
                    marginRight: 4,
                  }}
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
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    padding: 8,
                    borderRadius: 10,
                    marginHorizontal: 4,
                  }}
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
  style={{
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 10,
    marginLeft: 4,
  }}
  onPress={() => {
    if (!item.car) return;
    shareContent({
      id: item.id,
      type: 'autoclip',
      title: `${item.car.year} ${item.car.make} ${item.car.model} - Video`,
      message: `Check out this ${item.car.year} ${item.car.make} ${item.car.model} video on Fleet!${item.description ? `\n\n${item.description}` : ''}`
    });
  }}
>
  <Ionicons name="share-outline" size={24} color="white" />
</TouchableOpacity>
              </View>
            )}
          </LinearGradient>
        </View>
      );
    },
    [getFormattedPostDate, expandedDescriptions]
  );

  const getEstimatedBufferSize = useCallback(
    (networkType: Network.NetworkStateType | null) => {
      switch (networkType) {
        case Network.NetworkStateType.WIFI:
        case Network.NetworkStateType.ETHERNET:
          return 3 * AVG_VIDEO_CHUNK_SIZE_BYTES;
        case Network.NetworkStateType.CELLULAR:
          return 1.5 * AVG_VIDEO_CHUNK_SIZE_BYTES;
        default:
          return 2 * AVG_VIDEO_CHUNK_SIZE_BYTES;
      }
    },
    []
  );

  // Preload adjacent videos (only current and next)
  useEffect(() => {
    const preloadAdjacentVideos = async () => {
      if (autoClips.length > 0) {
        const visibleIndexes = [
          currentVideoIndex,
          Math.min(autoClips.length - 1, currentVideoIndex + 1),
        ];
        const estimatedBufferSize = getEstimatedBufferSize(networkType);
        for (const index of visibleIndexes) {
          const clip = autoClips[index];
          if (clip) {
            const ref = videoRefs.current[clip.id];
            if (ref && ref.current) {
              try {
                const localUri = await getCachedVideoUri(clip.video_url);
                const status = await ref.current.getStatusAsync();
                if (!status.isLoaded) {
                  await ref.current.loadAsync(
                    { uri: localUri },
                    {
                      shouldPlay: false,
                      isMuted: globalMute,
                      progressUpdateIntervalMillis:
                        networkType === Network.NetworkStateType.CELLULAR
                          ? 1000
                          : 250,
                    },
                    false
                  );
                }
              } catch (err) {
                console.error("Error preloading video:", err);
              }
            }
          }
        }
      }
    };
    preloadAdjacentVideos();
  }, [
    currentVideoIndex,
    autoClips,
    globalMute,
    networkType,
    getEstimatedBufferSize,
  ]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        const visibleClip = viewableItems[0].item;
        const newIndex = autoClips.findIndex(
          (clip) => clip.id === visibleClip.id
        );
        if (newIndex !== currentVideoIndex) {
          if (viewTimers.current[currentVideoIndex]) {
            clearTimeout(viewTimers.current[currentVideoIndex]);
          }
          setCurrentVideoIndex(newIndex);
          viewTimers.current[newIndex] = setTimeout(() => {
            trackClipView(visibleClip.id);
          }, 5000);
          Object.entries(videoRefs.current).forEach(async ([clipId, ref]) => {
            const shouldPlay = clipId === visibleClip.id.toString();
            try {
              if (shouldPlay) {
                await ref?.current?.setPositionAsync(0);

                if (allowVideoPlayback) {
                  await ref?.current?.playAsync();
                  setIsPlaying((prev) => ({ ...prev, [clipId]: true }));
                }
              } else {
                await ref?.current?.pauseAsync();
                setIsPlaying((prev) => ({ ...prev, [clipId]: false }));
              }
            } catch (err) {
              console.error("Error transitioning video:", err);
            }
          });
        }
      }
    },
    [autoClips, currentVideoIndex, trackClipView, allowVideoPlayback]
  );

  const handleSplashFinish = () => {
    console.log("Splash finished, enabling video playback");
    setAllowVideoPlayback(true);
  };

  return (
    <View
      style={[
        { flex: 1 },
        isDarkMode
          ? { backgroundColor: "black" }
          : { backgroundColor: "white" },
      ]}
    >
      <SplashScreen
        isDarkMode={isDarkMode}
        isLoading={isLoading}
        onSplashFinish={handleSplashFinish}
      />

      <TouchableOpacity
        style={{
          position: "absolute",
          top: 48,
          left: 16,
          zIndex: 50,
          backgroundColor: "rgba(0,0,0,0.6)",
          padding: 8,
          borderRadius: 9999,
          elevation: 5,
        }}
        onPress={() => router.back()}
      >
        <Ionicons name="home" size={24} color="white" />
      </TouchableOpacity>

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
            networkType={networkType}
            videoLoading={videoLoading}
            setVideoLoading={setVideoLoading}
            renderVideoControls={renderVideoControls}
            renderClipInfo={renderClipInfo}
            handlePlaybackStatusUpdate={handlePlaybackStatusUpdate}
            isDarkMode={isDarkMode}
            videoRefs={videoRefs}
            // Pass our new flag
            allowPlayback={allowVideoPlayback}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
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
        maxToRenderPerBatch={MAX_VIDEO_BUFFER}
        windowSize={MAX_VIDEO_BUFFER * 2 + 1}
        getItemLayout={(data, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
    padding: 16,
  },
  playPauseIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -25 }, { translateY: -25 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 30,
    padding: 10,
    zIndex: 10,
  },
  heartAnimation: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 11,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    backgroundColor: "#fff",
  },
  splashCircle: {
    position: "absolute",
    width: SPLASH_CIRCLE_SIZE,
    height: SPLASH_CIRCLE_SIZE,
    borderRadius: SPLASH_CIRCLE_SIZE / 2,
  },
  splashText: {
    fontSize: 28,
    fontWeight: "bold",
  },
  iconContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)", // Optional: Add a slight background dim
  },
});
