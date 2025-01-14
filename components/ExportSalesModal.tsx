import React, { useState, useCallback } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ActivityIndicator,
	Alert
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import Papa from 'papaparse'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { format, subMonths, isWithinInterval } from 'date-fns'

const TIME_RANGES = [
	{ label: 'Last Month', value: 1 },
	{ label: 'Last 3 Months', value: 3 },
	{ label: 'Last 6 Months', value: 6 },
	{ label: 'Last Year', value: 12 },
	{ label: 'All Time', value: 'all' }
]

const ExportSalesModal = ({
	isVisible,
	onClose,
	salesData,
	isDarkMode
}: any) => {
	const [isExporting, setIsExporting] = useState(false)
	const [selectedRange, setSelectedRange] = useState(null)

	const formatSaleData = useCallback(
		(sale: any) => ({
			'Sale Date': format(new Date(sale.date_sold), 'MM/dd/yyyy'),
			Vehicle: `${sale.year} ${sale.make} ${sale.model}`,
			'Purchase Date': format(new Date(sale.date_bought), 'MM/dd/yyyy'),
			'Days in Stock': Math.ceil(
				(new Date(sale.date_sold).getTime() -
					new Date(sale.date_bought).getTime()) /
					(1000 * 60 * 60 * 24)
			),
			'Bought Price': sale.bought_price,
			'Listed Price': sale.price,
			'Sold Price': sale.sold_price,
			'Actual Profit': sale.sold_price - sale.bought_price,
			'Expected Profit': sale.price - sale.bought_price,
			'Price Difference': sale.sold_price - sale.price,
			Buyer: sale.buyer_name || 'N/A',
			Seller: sale.seller_name || 'N/A'
		}),
		[]
	)

	const handleExport = async (months: string | number) => {
		try {
			setIsExporting(true)

			let filteredData = salesData
			if (months !== 'all') {
				const startDate = subMonths(new Date(), months)
				filteredData = salesData.filter(
					(sale: { date_sold: string | number | Date }) =>
						isWithinInterval(new Date(sale.date_sold), {
							start: startDate,
							end: new Date()
						})
				)
			}

			const formattedData = filteredData.map(formatSaleData)
			const csv = Papa.unparse(formattedData)

			const fileName = `sales_history_${
				months === 'all' ? 'all_time' : `last_${months}_months`
			}_${format(new Date(), 'yyyy-MM-dd')}.csv`
			const filePath = `${FileSystem.documentDirectory}${fileName}`

			await FileSystem.writeAsStringAsync(filePath, csv)
			await Sharing.shareAsync(filePath, {
				mimeType: 'text/csv',
				dialogTitle: 'Export Sales History',
				UTI: 'public.comma-separated-values-text'
			})
		} catch (error) {
			console.error('Error exporting data:', error)
			Alert.alert(
				'Export Error',
				'Failed to export sales data. Please try again.'
			)
		} finally {
			setIsExporting(false)
			setSelectedRange(null)
			onClose()
		}
	}

	if (!isVisible) return null

	return (
		<BlurView
			intensity={100}
			tint={isDarkMode ? 'dark' : 'light'}
			style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
			className='rounded-t-3xl mb-10'>
			<View
				className={`${
					isDarkMode ? 'bg-gray/80' : 'bg-white/80'
				} rounded-t-3xl p-6`}>
				<View className='flex-row justify-between items-center mb-6'>
					<Text
						className={`text-xl font-bold ${
							isDarkMode ? 'text-white' : 'text-black'
						}`}>
						Export Sales History
					</Text>
					<TouchableOpacity onPress={onClose}>
						<Ionicons
							name='close'
							size={24}
							color={isDarkMode ? '#D55004' : '#FF8C00'}
						/>
					</TouchableOpacity>
				</View>

				<Text
					className={`text-sm mb-4 ${isDarkMode ? 'text-white' : 'text-gray'}`}>
					Select a time range to export your sales data as CSV
				</Text>

				<View className='space-y-3'>
					{TIME_RANGES.map(range => (
						<TouchableOpacity
							key={range.value}
							onPress={() => handleExport(range.value)}
							disabled={isExporting}
							className={`p-4 rounded-xl flex-row justify-between items-center border
                ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}
                ${isExporting ? 'opacity-50' : 'opacity-100'}
                ${
									selectedRange === range.value ? 'bg-red/10 border-red' : ''
								}`}>
							<Text
								className={`text-lg ${
									isDarkMode ? 'text-white' : 'text-black'
								}`}>
								{range.label}
							</Text>
							<Ionicons
								name='chevron-forward'
								size={20}
								color={isDarkMode ? '#D55004' : '#FF8C00'}
							/>
						</TouchableOpacity>
					))}
				</View>
			</View>
		</BlurView>
	)
}

export default ExportSalesModal
