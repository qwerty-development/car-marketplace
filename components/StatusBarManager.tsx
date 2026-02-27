import React, { useEffect } from 'react'
import { StatusBar, Platform, useColorScheme } from 'react-native'
import { useTheme } from '@/utils/ThemeContext'

/**
 * Global StatusBar manager component that handles proper status bar appearance
 * across both iOS and Android platforms, including production builds.
 */
export default function StatusBarManager() {
  const { isDarkMode } = useTheme()
  // Fallback to system theme if ThemeContext is not available
  const systemColorScheme = useColorScheme()
  const effectiveDarkMode = isDarkMode ?? (systemColorScheme === 'dark')
  
  useEffect(() => {
    // Set Android-specific status bar properties
    if (Platform.OS === 'android') {
      // Transparent background for edge-to-edge mode (SDK 54+)
      StatusBar.setBackgroundColor('transparent', true)
      StatusBar.setTranslucent(true)
      
      // Set status bar text/icon color based on theme
      StatusBar.setBarStyle(
        effectiveDarkMode ? 'light-content' : 'dark-content'
      )
    }
  }, [effectiveDarkMode])
  
  // This handles iOS status bar
  return (
    <StatusBar
      barStyle={effectiveDarkMode ? 'light-content' : 'dark-content'}
      backgroundColor="transparent"
      translucent={true}
    />
  )
}