import React from 'react'
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { useTheme } from '@/utils/ThemeContext'
import { Feather } from '@expo/vector-icons'

const ThemeSwitch = () => {
	const { isDarkMode, toggleTheme } = useTheme()
	const [animation] = React.useState(new Animated.Value(isDarkMode ? 1 : 0))

	React.useEffect(() => {
		Animated.timing(animation, {
			toValue: isDarkMode ? 1 : 0,
			duration: 300,
			useNativeDriver: false
		}).start()
	}, [isDarkMode])

	const toggleSwitchAnimation = animation.interpolate({
		inputRange: [0, 1],
		outputRange: [4, 36]
	})

	return (
		<TouchableOpacity
			onPress={toggleTheme}
			activeOpacity={0.8}
			style={styles.switchContainer}
			className='ml-3'>
			<Animated.View
				style={[
					styles.switchToggle,
					{ transform: [{ translateX: toggleSwitchAnimation }] }
				]}>
				{isDarkMode ? (
					<Feather name='moon' size={16} color='#D55004' />
				) : (
					<Feather name='sun' size={16} color='#D55004' />
				)}
			</Animated.View>
			<View style={styles.iconsContainer}>
				{!isDarkMode && <View style={styles.iconPlaceholder} />}
				{isDarkMode && <Feather name='sun' size={16} color='#f4f4f4' />}
				{isDarkMode && <View style={styles.iconPlaceholder} />}
				{!isDarkMode && <Feather name='moon' size={16} color='#f4f4f4' />}
			</View>
		</TouchableOpacity>
	)
}

const styles = StyleSheet.create({
	switchContainer: {
		width: 70,
		height: 36,
		borderRadius: 18,
		backgroundColor: '#D55004',
		justifyContent: 'center'
	},
	switchToggle: {
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: 'white',
		position: 'absolute',
		justifyContent: 'center',
		alignItems: 'center',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 2
	},
	iconsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 8
	},
	iconPlaceholder: {
		width: 16,
		height: 16
	}
})

export default ThemeSwitch
