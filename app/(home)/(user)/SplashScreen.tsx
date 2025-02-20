import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions
} from 'react-native'

const { height, width } = Dimensions.get('window')
const SPLASH_CIRCLE_SIZE = width * 2
const BG_FADE_DURATION = 400
const CIRCLE_ANIM_DURATION = 500 // Slower circle animations
const CIRCLE_STAGGER_DELAY = 100 // More delay between circles
const TEXT_ANIM_DURATION = 500
const TEXT_STAGGER_DELAY = 500
const EXIT_FADE_DURATION = 300

type SplashPhase = 'entrance' | 'holding' | 'exit'

interface SplashScreenProps {
  isDarkMode: boolean
  isLoading: boolean
  onSplashFinish: () => void
}

export default function SplashScreen({
  isDarkMode,
  isLoading,
  onSplashFinish
}: SplashScreenProps) {
  const [showSplash, setShowSplash] = useState(true)
  const [splashPhase, setSplashPhase] = useState<SplashPhase>('entrance')

  // Background fade
  const backgroundOpacity = useRef(new Animated.Value(0)).current

  // Circles with opacity and scale
  const circles = Array(3).fill(0).map(() => ({
    scale: useRef(new Animated.Value(0)).current,
    opacity: useRef(new Animated.Value(0)).current
  }))

  // Split text animations
  const titleOpacity = useRef(new Animated.Value(0)).current
  const titleTranslateY = useRef(new Animated.Value(20)).current
  const subtitleOpacity = useRef(new Animated.Value(0)).current
  const subtitleTranslateY = useRef(new Animated.Value(20)).current

  // Container fade out
  const containerOpacity = useRef(new Animated.Value(1)).current

  // Entrance animation sequence
  useEffect(() => {
    if (splashPhase === 'entrance') {
      // 1. Background fade in
      const backgroundAnimation = Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: BG_FADE_DURATION,
        useNativeDriver: true
      })

      // 2. Circle animations with longer stagger
      const circleAnimations = circles.map((circle, index) => 
        Animated.sequence([
          // Wait for background + delay per circle
          Animated.delay(BG_FADE_DURATION + (index * CIRCLE_STAGGER_DELAY)),
          Animated.parallel([
            Animated.timing(circle.opacity, {
              toValue: 0.8,
              duration: CIRCLE_ANIM_DURATION,
              useNativeDriver: true
            }),
            Animated.spring(circle.scale, {
              toValue: 1,
              friction: 10, // More friction for slower movement
              tension: 35,  // Less tension for gentler animation
              useNativeDriver: true
            })
          ])
        ])
      )

      // 3. Text animations with sequence
      const titleAnimation = Animated.sequence([
        // Wait for last circle to finish
        Animated.delay(BG_FADE_DURATION + (CIRCLE_STAGGER_DELAY * 3) + CIRCLE_ANIM_DURATION),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: TEXT_ANIM_DURATION,
            useNativeDriver: true
          }),
          Animated.spring(titleTranslateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true
          })
        ])
      ])

      // 4. Subtitle animation
      const subtitleAnimation = Animated.sequence([
        // Wait for title animation
        Animated.delay(BG_FADE_DURATION + (CIRCLE_STAGGER_DELAY * 3) + CIRCLE_ANIM_DURATION + TEXT_STAGGER_DELAY),
        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: TEXT_ANIM_DURATION,
            useNativeDriver: true
          }),
          Animated.spring(subtitleTranslateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true
          })
        ])
      ])

      Animated.parallel([
        backgroundAnimation,
        ...circleAnimations,
        titleAnimation,
        subtitleAnimation
      ]).start(() => setSplashPhase('holding'))
    }
  }, [splashPhase])

  // Exit animation
  useEffect(() => {
    if (splashPhase === 'holding' && !isLoading) {
      setSplashPhase('exit')
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: EXIT_FADE_DURATION,
        useNativeDriver: true
      }).start(() => {
        setShowSplash(false)
        onSplashFinish()
      })
    }
  }, [splashPhase, isLoading])

  if (!showSplash) return null

  return (
    <Animated.View
      style={[
        styles.splashContainer,
        {
          opacity: containerOpacity
        }
      ]}
    >
      {/* Background with fade in */}
      <Animated.View 
        style={[
          styles.background,
          {
            backgroundColor: isDarkMode ? '#000' : '#fff',
            opacity: backgroundOpacity
          }
        ]} 
      />

      {circles.map((circle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.splashCircle,
            {
              top: index === 0 ? -SPLASH_CIRCLE_SIZE * 0.3 :
                   index === 1 ? height * 0.4 :
                   undefined,
              bottom: index === 2 ? -SPLASH_CIRCLE_SIZE * 0.3 : undefined,
              left: index === 0 ? -SPLASH_CIRCLE_SIZE * 0.3 :
                    index === 1 ? width * 0.2 :
                    undefined,
              right: index === 2 ? -SPLASH_CIRCLE_SIZE * 0.3 : undefined,
              transform: [{ scale: circle.scale }],
              opacity: circle.opacity
            }
          ]}
        />
      ))}

      <View style={styles.textContainer}>
        <Animated.Text
          style={[
            styles.titleText,
            {
              color: isDarkMode ? '#fff' : '#000',
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }]
            }
          ]}
        >
          Autoclips
        </Animated.Text>
        <Animated.Text
          style={[
            styles.subtitleText,
            {
              color: isDarkMode ? '#fff' : '#000',
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleTranslateY }]
            }
          ]}
        >
          by Fleet
        </Animated.Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  splashCircle: {
    position: 'absolute',
    width: SPLASH_CIRCLE_SIZE,
    height: SPLASH_CIRCLE_SIZE,
    borderRadius: SPLASH_CIRCLE_SIZE / 2,
    backgroundColor: '#D55004'
  },
  textContainer: {
    alignItems: 'center'
  },
  titleText: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8
  },
  subtitleText: {
    fontSize: 24,
    fontWeight: '500'
  }
})