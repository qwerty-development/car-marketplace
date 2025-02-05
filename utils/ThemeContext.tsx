import React, {
    createContext,
    useState,
    useEffect,
    useContext,
    ReactNode
} from 'react'
// Remove this import
// import { useColorScheme } from 'react-native'
// And use your custom hook instead
import useColorScheme from '@/hooks/useColorScheme' // Adjust the path as needed

type ThemeContextType = {
    isDarkMode: boolean
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

type ThemeProviderProps = {
    children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    // This will now use your custom hook with the delay
    const colorScheme = useColorScheme(500) // You can adjust the delay if needed
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