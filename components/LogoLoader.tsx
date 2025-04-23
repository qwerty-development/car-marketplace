import React, { useEffect, useRef } from 'react'
import { Animated, Image, View, useColorScheme, StyleSheet } from 'react-native'

export default function LogoLoader() {
  const blinkAnim = useRef(new Animated.Value(1)).current
  const colorScheme = useColorScheme()

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [])

  const logo = colorScheme === 'dark'
    ? require('@/assets/images/light-logo.png')
    : require('@/assets/images/dark-logo.png')

  return (
    <View style={[styles.container, {
      backgroundColor: colorScheme === 'dark' ? '#000' : '#fff'
    }]}>
      <Animated.Image
        source={logo}
        style={[styles.logo, { opacity: blinkAnim }]}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
})
