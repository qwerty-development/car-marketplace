import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SkeletonCard = ({ isDarkMode, index }:any) => {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // Animation for fading in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer effect (pulse)
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fadeAnim, slideAnim, index]);

  const backgroundColor = isDarkMode ? "#222" : "#fff";
  const shimmerColor = isDarkMode ? "#333" : "#f0f0f0";

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          backgroundColor: backgroundColor,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.cardContent}>
        {/* Logo placeholder circle */}
        <Animated.View
          style={[
            styles.logoPlaceholder,
            { backgroundColor: shimmerColor },
          ]}
        />

        <View style={styles.textContent}>
          {/* Title placeholder */}
          <Animated.View
            style={[
              styles.titlePlaceholder,
              { backgroundColor: shimmerColor },
            ]}
          />

          {/* Location row placeholder */}
          <View style={styles.infoRow}>
            <Animated.View
              style={[
                styles.iconPlaceholder,
                { backgroundColor: shimmerColor },
              ]}
            />
            <Animated.View
              style={[
                styles.infoTextPlaceholder,
                { backgroundColor: shimmerColor },
              ]}
            />
          </View>

          {/* Cars row placeholder */}
          <View style={styles.infoRow}>
            <Animated.View
              style={[
                styles.iconPlaceholder,
                { backgroundColor: shimmerColor },
              ]}
            />
            <Animated.View
              style={[
                styles.infoTextPlaceholder,
                styles.shorterText,
                { backgroundColor: shimmerColor },
              ]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const DealershipSkeletonLoading = ({ isDarkMode, count = 5 }:any) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} isDarkMode={isDarkMode} index={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 8,
  },
  cardContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  textContent: {
    flex: 1,
    marginLeft: 16,
  },
  titlePlaceholder: {
    height: 20,
    width: "70%",
    borderRadius: 4,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  iconPlaceholder: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  infoTextPlaceholder: {
    height: 14,
    width: "60%",
    borderRadius: 4,
    marginLeft: 4,
  },
  shorterText: {
    width: "40%",
  },
});

export default DealershipSkeletonLoading;