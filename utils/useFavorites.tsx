// hooks/useFavorites.tsx
import React, { createContext, useState, useContext, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { useUser } from '@clerk/clerk-expo'

interface FavoritesContextType {
	favorites: number[]
	addFavorite: (carId: number) => Promise<void>
	removeFavorite: (carId: number) => Promise<void>
	isFavorite: (carId: number) => boolean
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(
	undefined
)

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({
	children
}) => {
	const [favorites, setFavorites] = useState<number[]>([])
	const { user } = useUser()

	useEffect(() => {
		if (user) {
			fetchFavorites()
		}
	}, [user])

	const fetchFavorites = async () => {
		if (!user) return
		const { data, error } = await supabase
			.from('users')
			.select('favorite')
			.eq('id', user.id)
			.single()

		if (error) {
			console.error('Error fetching favorites:', error)
		} else {
			setFavorites(data?.favorite || [])
		}
	}

	const addFavorite = async (carId: number) => {
		if (!user) return
		const newFavorites = [...favorites, carId]
		await updateFavorites(newFavorites)
	}

	const removeFavorite = async (carId: number) => {
		if (!user) return
		const newFavorites = favorites.filter(id => id !== carId)
		await updateFavorites(newFavorites)
	}

	const updateFavorites = async (newFavorites: number[]) => {
		if (!user) return
		const { error } = await supabase
			.from('users')
			.update({ favorite: newFavorites })
			.eq('id', user.id)

		if (error) {
			console.error('Error updating favorites:', error)
		} else {
			setFavorites(newFavorites)
		}
	}

	const isFavorite = (carId: number) => favorites.includes(carId)

	return (
		<FavoritesContext.Provider
			value={{ favorites, addFavorite, removeFavorite, isFavorite }}>
			{children}
		</FavoritesContext.Provider>
	)
}

export const useFavorites = () => {
	const context = useContext(FavoritesContext)
	if (context === undefined) {
		throw new Error('useFavorites must be used within a FavoritesProvider')
	}
	return context
}
