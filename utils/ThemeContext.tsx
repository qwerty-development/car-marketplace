import React, {
	createContext,
	useState,
	useEffect,
	useContext,
	ReactNode
} from 'react'
import { useColorScheme } from 'react-native'

type ThemeContextType = {
	isDarkMode: boolean
	toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

type ThemeProviderProps = {
	children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
	const colorScheme = useColorScheme()
	const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark')

	useEffect(() => {
		setIsDarkMode(colorScheme === 'dark')
	}, [colorScheme])

	const toggleTheme = () => {
		setIsDarkMode(prev => !prev)
	}

	return (
		<ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	)
}

export const useTheme = () => {
	const context = useContext(ThemeContext)
	if (context === undefined) {
		throw new Error('useTheme must be used within a ThemeProvider')
	}
	return context
}
