import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Switch,
  TextInput,
  Platform,
  StyleSheet
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import Papa from 'papaparse'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns'

const TIME_RANGES = [
  { label: 'Last Month', value: 1 },
  { label: 'Last 3 Months', value: 3 },
  { label: 'Last 6 Months', value: 6 },
  { label: 'Last Year', value: 12 },
  { label: 'Custom Range', value: 'custom' },
  { label: 'All Time', value: 'all' }
]

const EXPORT_FORMATS = [
  { label: 'CSV', value: 'csv', icon: 'file-delimited-outline' },
  { label: 'Excel CSV', value: 'excel', icon: 'microsoft-excel' },
  { label: 'JSON', value: 'json', icon: 'code-json' }
]

const FIELD_GROUPS = {
  basics: {
    title: 'Basic Information',
    fields: [
      { key: 'saleDate', label: 'Sale Date', selected: true },
      { key: 'vehicle', label: 'Vehicle', selected: true },
      { key: 'purchaseDate', label: 'Purchase Date', selected: true },
      { key: 'daysInStock', label: 'Days in Stock', selected: true }
    ]
  },
  financial: {
    title: 'Financial Details',
    fields: [
      { key: 'boughtPrice', label: 'Bought Price', selected: true },
      { key: 'listedPrice', label: 'Listed Price', selected: true },
      { key: 'soldPrice', label: 'Sold Price', selected: true },
      { key: 'actualProfit', label: 'Actual Profit', selected: true },
      { key: 'expectedProfit', label: 'Expected Profit', selected: true },
      { key: 'priceDifference', label: 'Price Difference', selected: true },
      { key: 'profitMargin', label: 'Profit Margin %', selected: true }
    ]
  },
  people: {
    title: 'People',
    fields: [
      { key: 'buyer', label: 'Buyer', selected: true },
      { key: 'seller', label: 'Seller', selected: true }
    ]
  },
  additional: {
    title: 'Additional Details',
    fields: [
      { key: 'make', label: 'Make', selected: false },
      { key: 'model', label: 'Model', selected: false },
      { key: 'year', label: 'Year', selected: false },
      { key: 'views', label: 'Views', selected: false },
      { key: 'daysListed', label: 'Days Listed', selected: false }
    ]
  }
}

const ExportSalesModal = ({
  isVisible,
  onClose,
  salesData,
  isDarkMode
}) => {
  const { t } = useTranslation()
  
  // State for export options
  const [isExporting, setIsExporting] = useState(false)
  const [selectedRange, setSelectedRange] = useState('all')
  const [exportFormat, setExportFormat] = useState('csv')
  const [customStartDate, setCustomStartDate] = useState(subMonths(new Date(), 1))
  const [customEndDate, setCustomEndDate] = useState(new Date())
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [includeHeaderRow, setIncludeHeaderRow] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [step, setStep] = useState(1) // 1: Select range, 2: Select fields, 3: Format options
  const [fieldGroups, setFieldGroups] = useState(FIELD_GROUPS)
  const [filterMake, setFilterMake] = useState('')
  const [filterMinProfit, setFilterMinProfit] = useState('')
  const [filterMaxProfit, setFilterMaxProfit] = useState('')
  const [isCustomFiltersVisible, setIsCustomFiltersVisible] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  // Reset the export modal when it's opened
  useEffect(() => {
    if (isVisible) {
      setStep(1)
      setExportProgress(0)
      setExportSuccess(false)
    }
  }, [isVisible])

  // Get list of all selected fields
  const selectedFields = useMemo(() => {
    const fields = []
    Object.values(fieldGroups).forEach(group => {
      group.fields.forEach(field => {
        if (field.selected) {
          fields.push(field.key)
        }
      })
    })
    return fields
  }, [fieldGroups])

  // Toggle a field selection
  const toggleField = useCallback((groupKey, fieldKey) => {
    setFieldGroups(prev => {
      const newGroups = { ...prev }
      const fieldIndex = newGroups[groupKey].fields.findIndex(f => f.key === fieldKey)
      if (fieldIndex !== -1) {
        newGroups[groupKey].fields[fieldIndex].selected = !newGroups[groupKey].fields[fieldIndex].selected
      }
      return newGroups
    })
  }, [])

  // Toggle all fields in a group
  const toggleGroup = useCallback((groupKey, value) => {
    setFieldGroups(prev => {
      const newGroups = { ...prev }
      newGroups[groupKey].fields = newGroups[groupKey].fields.map(field => ({
        ...field,
        selected: value
      }))
      return newGroups
    })
  }, [])

  // Select all fields
  const selectAllFields = useCallback(() => {
    setFieldGroups(prev => {
      const newGroups = { ...prev }
      Object.keys(newGroups).forEach(groupKey => {
        newGroups[groupKey].fields = newGroups[groupKey].fields.map(field => ({
          ...field,
          selected: true
        }))
      })
      return newGroups
    })
  }, [])

  // Deselect all fields
  const deselectAllFields = useCallback(() => {
    setFieldGroups(prev => {
      const newGroups = { ...prev }
      Object.keys(newGroups).forEach(groupKey => {
        newGroups[groupKey].fields = newGroups[groupKey].fields.map(field => ({
          ...field,
          selected: false
        }))
      })
      return newGroups
    })
  }, [])

  // Format sale data for export
  const formatSaleData = useCallback((sale) => {
    const formattedSale = {}

    // Calculate some values first
    const daysInStock = Math.ceil(
      (new Date(sale.date_sold).getTime() - new Date(sale.date_bought).getTime()) /
      (1000 * 60 * 60 * 24)
    )

    const daysListed = Math.ceil(
      (new Date(sale.date_sold).getTime() - new Date(sale.listed_at).getTime()) /
      (1000 * 60 * 60 * 24)
    )

    const actualProfit = sale.sold_price - sale.bought_price
    const expectedProfit = sale.price - sale.bought_price
    const priceDifference = sale.sold_price - sale.price
    const profitMargin = ((actualProfit / sale.bought_price) * 100).toFixed(2)

    // Map selected fields to values
    if (selectedFields.includes('saleDate')) {
      formattedSale['Sale Date'] = format(new Date(sale.date_sold), 'MM/dd/yyyy')
    }

    if (selectedFields.includes('vehicle')) {
      formattedSale['Vehicle'] = `${sale.year} ${sale.make} ${sale.model}`
    }

    if (selectedFields.includes('make')) {
      formattedSale['Make'] = sale.make
    }

    if (selectedFields.includes('model')) {
      formattedSale['Model'] = sale.model
    }

    if (selectedFields.includes('year')) {
      formattedSale['Year'] = sale.year
    }

    if (selectedFields.includes('purchaseDate')) {
      formattedSale['Purchase Date'] = format(new Date(sale.date_bought), 'MM/dd/yyyy')
    }

    if (selectedFields.includes('daysInStock')) {
      formattedSale['Days in Stock'] = daysInStock
    }

    if (selectedFields.includes('daysListed')) {
      formattedSale['Days Listed'] = daysListed
    }

    if (selectedFields.includes('boughtPrice')) {
      formattedSale['Bought Price'] = sale.bought_price
    }

    if (selectedFields.includes('listedPrice')) {
      formattedSale['Listed Price'] = sale.price
    }

    if (selectedFields.includes('soldPrice')) {
      formattedSale['Sold Price'] = sale.sold_price
    }

    if (selectedFields.includes('actualProfit')) {
      formattedSale['Actual Profit'] = actualProfit
    }

    if (selectedFields.includes('expectedProfit')) {
      formattedSale['Expected Profit'] = expectedProfit
    }

    if (selectedFields.includes('priceDifference')) {
      formattedSale['Price Difference'] = priceDifference
    }

    if (selectedFields.includes('profitMargin')) {
      formattedSale['Profit Margin %'] = profitMargin
    }

    if (selectedFields.includes('buyer')) {
      formattedSale['Buyer'] = sale.buyer_name || 'N/A'
    }

    if (selectedFields.includes('seller')) {
      formattedSale['Seller'] = sale.seller_name || 'N/A'
    }

    if (selectedFields.includes('views')) {
      formattedSale['Views'] = sale.views || 0
    }

    return formattedSale
  }, [selectedFields])

  // Get filtered data based on selected time range and filters
  const getFilteredData = useCallback(() => {
    let filteredData = [...salesData]

    // Apply date range filter
    if (selectedRange !== 'all') {
      if (selectedRange === 'custom') {
        filteredData = filteredData.filter(sale =>
          isWithinInterval(new Date(sale.date_sold), {
            start: startOfDay(customStartDate),
            end: endOfDay(customEndDate)
          })
        )
      } else {
        const startDate = subMonths(new Date(), selectedRange)
        filteredData = filteredData.filter(sale =>
          isWithinInterval(new Date(sale.date_sold), {
            start: startDate,
            end: new Date()
          })
        )
      }
    }

    // Apply make filter
    if (filterMake) {
      filteredData = filteredData.filter(sale =>
        sale.make.toLowerCase().includes(filterMake.toLowerCase())
      )
    }

    // Apply profit filters
    if (filterMinProfit) {
      const minProfit = parseInt(filterMinProfit, 10)
      filteredData = filteredData.filter(sale =>
        (sale.sold_price - sale.bought_price) >= minProfit
      )
    }

    if (filterMaxProfit) {
      const maxProfit = parseInt(filterMaxProfit, 10)
      filteredData = filteredData.filter(sale =>
        (sale.sold_price - sale.bought_price) <= maxProfit
      )
    }

    return filteredData
  }, [salesData, selectedRange, customStartDate, customEndDate, filterMake, filterMinProfit, filterMaxProfit])

  // Calculate summary statistics
  const calculateSummary = useCallback((data) => {
    if (data.length === 0) return {}

    const totalBought = data.reduce((sum, sale) => sum + sale.bought_price, 0)
    const totalListed = data.reduce((sum, sale) => sum + sale.price, 0)
    const totalSold = data.reduce((sum, sale) => sum + sale.sold_price, 0)
    const totalProfit = data.reduce((sum, sale) => sum + (sale.sold_price - sale.bought_price), 0)
    const avgProfit = totalProfit / data.length
    const avgProfitMargin = (totalProfit / totalBought) * 100

    const totalDaysInStock = data.reduce((sum, sale) => {
      const days = Math.ceil(
        (new Date(sale.date_sold).getTime() - new Date(sale.date_bought).getTime()) /
        (1000 * 60 * 60 * 24)
      )
      return sum + days
    }, 0)
    const avgDaysInStock = totalDaysInStock / data.length

    return {
      'Total Sales': data.length,
      'Total Bought Price': totalBought,
      'Total Listed Price': totalListed,
      'Total Sold Price': totalSold,
      'Total Profit': totalProfit,
      'Average Profit': avgProfit.toFixed(2),
      'Average Profit Margin %': avgProfitMargin.toFixed(2),
      'Average Days in Stock': avgDaysInStock.toFixed(1)
    }
  }, [])

  // Handle export
  const handleExport = async () => {
    try {
      setIsExporting(true)
      setExportProgress(10)

      const filteredData = getFilteredData()

      if (filteredData.length === 0) {
        Alert.alert(
          'No Data',
          'There are no sales matching your selected filters.',
          [{ text: 'OK' }]
        )
        setIsExporting(false)
        return
      }

      setExportProgress(30)

      // Format data
      const formattedData = filteredData.map(formatSaleData)

      // Add summary row if requested
      let dataToExport = [...formattedData]
      let summary = {}

      if (includeSummary) {
        summary = calculateSummary(filteredData)

        // For CSV and Excel, add empty rows and then summary
        if (exportFormat === 'csv' || exportFormat === 'excel') {
          dataToExport.push({})
          dataToExport.push({ 'Sale Date': '=== SUMMARY ===' })

          Object.entries(summary).forEach(([key, value]) => {
            const summaryRow = {}
            summaryRow['Sale Date'] = key
            summaryRow['Vehicle'] = value
            dataToExport.push(summaryRow)
          })
        }
      }

      setExportProgress(60)

      // Prepare file content based on format
      let fileContent
      let fileExtension
      let mimeType

      if (exportFormat === 'csv') {
        fileContent = Papa.unparse(dataToExport, {
          header: includeHeaderRow,
          quotes: true
        })
        fileExtension = 'csv'
        mimeType = 'text/csv'
      } else if (exportFormat === 'excel') {
        // Excel-friendly CSV (with BOM for proper Unicode handling)
        fileContent = '\ufeff' + Papa.unparse(dataToExport, {
          header: includeHeaderRow,
          quotes: true,
          delimiter: ','
        })
        fileExtension = 'csv'
        mimeType = 'text/csv'
      } else if (exportFormat === 'json') {
        const jsonData = {
          sales: formattedData,
          summary: includeSummary ? summary : undefined,
          exportDate: new Date().toISOString(),
          totalRecords: filteredData.length
        }
        fileContent = JSON.stringify(jsonData, null, 2)
        fileExtension = 'json'
        mimeType = 'application/json'
      }

      setExportProgress(80)

      // Generate filename
      const dateRange = selectedRange === 'custom'
        ? `${format(customStartDate, 'yyyy-MM-dd')}_to_${format(customEndDate, 'yyyy-MM-dd')}`
        : selectedRange === 'all'
          ? 'all_time'
          : `last_${selectedRange}_months`

      const fileName = `sales_history_${dateRange}_${format(new Date(), 'yyyy-MM-dd')}.${fileExtension}`
      const filePath = `${FileSystem.documentDirectory}${fileName}`

      // Write to file
      await FileSystem.writeAsStringAsync(filePath, fileContent)

      setExportProgress(90)

      // Share file
      await Sharing.shareAsync(filePath, {
        mimeType,
        dialogTitle: 'Export Sales History',
        UTI: fileExtension === 'csv'
          ? 'public.comma-separated-values-text'
          : 'public.json'
      })

      setExportProgress(100)
      setExportSuccess(true)

      // Reset state after successful export
      setTimeout(() => {
        setIsExporting(false)
        onClose()
      }, 1000)
    } catch (error) {
      console.error('Error exporting data:', error)
      Alert.alert(
        'Export Error',
        'Failed to export sales data. Please try again.',
        [{ text: 'OK' }]
      )
      setIsExporting(false)
    }
  }

  // Handle navigation between steps
  const nextStep = useCallback(() => {
    if (step < 3) setStep(step + 1)
    else handleExport()
  }, [step, handleExport])

  const prevStep = useCallback(() => {
    if (step > 1) setStep(step - 1)
  }, [step])

  if (!isVisible) return null

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <BlurView
        intensity={100}
        tint={isDarkMode ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }
          ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? '#D55004' : '#FF8C00'}
              />
            </TouchableOpacity>
            <Text style={[
              styles.headerTitle,
              { color: isDarkMode ? '#fff' : '#000' }
            ]}>
              Export Sales Data
            </Text>
            {step < 3 && (
              <TouchableOpacity onPress={nextStep} style={styles.nextButton}>
                <Text style={{ color: '#D55004' }}>
                  {step === 1 ? 'Select Fields' : 'Options'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Steps */}
          <View style={styles.stepsContainer}>
            {[1, 2, 3].map(stepNum => (
              <View key={stepNum} style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  step >= stepNum ? styles.activeStepCircle : {},
                  { backgroundColor: step >= stepNum ? '#D55004' : isDarkMode ? '#444' : '#ccc' }
                ]}>
                  <Text style={styles.stepNumber}>
                    {stepNum}
                  </Text>
                </View>
                <Text style={[
                  styles.stepLabel,
                  { color: isDarkMode ? '#fff' : '#000' },
                  step >= stepNum ? styles.activeStepLabel : {}
                ]}>
                  {stepNum === 1 ? 'Date Range' : stepNum === 2 ? 'Fields' : 'Format'}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Step 1: Select Date Range */}
            {step === 1 && (
              <View>
                <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                  Select Date Range
                </Text>

                <View style={styles.timeRangeGrid}>
                  {TIME_RANGES.map(range => (
                    <TouchableOpacity
                      key={range.value}
                      onPress={() => setSelectedRange(range.value)}
                      style={[
                        styles.timeRangeOption,
                        selectedRange === range.value && styles.selectedTimeRange,
                        { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
                      ]}>
                      <Text style={[
                        styles.timeRangeLabel,
                        { color: isDarkMode ? '#fff' : '#000' },
                        selectedRange === range.value && { color: '#D55004' }
                      ]}>
                        {range.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {selectedRange === 'custom' && (
                  <View style={styles.customDateContainer}>
                    <Text style={[
                      styles.dateLabel,
                      { color: isDarkMode ? '#fff' : '#000' }
                    ]}>
                      Custom Date Range
                    </Text>

                    <View style={styles.datePickerRow}>
                      <TouchableOpacity
                        style={[
                          styles.datePickerButton,
                          { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
                        ]}
                        onPress={() => setShowStartDatePicker(true)}>
                        <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>
                          {format(customStartDate, 'MMM d, yyyy')}
                        </Text>
                      </TouchableOpacity>

                      <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>
                        to
                      </Text>

                      <TouchableOpacity
                        style={[
                          styles.datePickerButton,
                          { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
                        ]}
                        onPress={() => setShowEndDatePicker(true)}>
                        <Text style={{ color: isDarkMode ? '#fff' : '#000' }}>
                          {format(customEndDate, 'MMM d, yyyy')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showStartDatePicker && (
                      <DateTimePicker
                        value={customStartDate}
                        mode="date"
                        display="default"
                        onChange={(event, date) => {
                          setShowStartDatePicker(false)
                          if (date) setCustomStartDate(date)
                        }}
                      />
                    )}

                    {showEndDatePicker && (
                      <DateTimePicker
                        value={customEndDate}
                        mode="date"
                        display="default"
                        onChange={(event, date) => {
                          setShowEndDatePicker(false)
                          if (date) setCustomEndDate(date)
                        }}
                      />
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.filterToggle}
                  onPress={() => setIsCustomFiltersVisible(!isCustomFiltersVisible)}>
                  <Text style={{ color: '#D55004' }}>
                    {isCustomFiltersVisible ? 'Hide Filters' : 'Show Additional Filters'}
                  </Text>
                  <Ionicons
                    name={isCustomFiltersVisible ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#D55004"
                  />
                </TouchableOpacity>

                {isCustomFiltersVisible && (
                  <View style={styles.filtersContainer}>
                    <View style={styles.filterItem}>
                      <Text style={[styles.filterLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                        Vehicle Make
                      </Text>
                      <TextInput
                        style={[
                          styles.filterInput,
                          {
                            backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
                            color: isDarkMode ? '#fff' : '#000'
                          }
                        ]}
                        value={filterMake}
                        onChangeText={setFilterMake}
                        placeholder={t('common.filter_by_make')}
                        placeholderTextColor={isDarkMode ? '#999' : '#666'}
                      />
                    </View>

                    <View style={styles.filterRow}>
                      <View style={[styles.filterItem, { flex: 1, marginRight: 8 }]}>
                        <Text style={[styles.filterLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                          Min Profit
                        </Text>
                        <TextInput
                          style={[
                            styles.filterInput,
                            {
                              backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
                              color: isDarkMode ? '#fff' : '#000'
                            }
                          ]}
                          value={filterMinProfit}
                          onChangeText={setFilterMinProfit}
                          placeholder="Min $"
                          placeholderTextColor={isDarkMode ? '#999' : '#666'}
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={[styles.filterItem, { flex: 1 }]}>
                        <Text style={[styles.filterLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                          Max Profit
                        </Text>
                        <TextInput
                          style={[
                            styles.filterInput,
                            {
                              backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
                              color: isDarkMode ? '#fff' : '#000'
                            }
                          ]}
                          value={filterMaxProfit}
                          onChangeText={setFilterMaxProfit}
                          placeholder="Max $"
                          placeholderTextColor={isDarkMode ? '#999' : '#666'}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Step 2: Select Fields */}
            {step === 2 && (
              <View>
                <View style={styles.fieldSelectHeader}>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                    Select Fields to Export
                  </Text>

                  <View style={styles.fieldSelectActions}>
                    <TouchableOpacity
                      style={styles.fieldSelectAction}
                      onPress={selectAllFields}>
                      <Text style={{ color: '#D55004' }}>
                        Select All
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.fieldSelectAction}
                      onPress={deselectAllFields}>
                      <Text style={{ color: '#D55004' }}>
                        Deselect All
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {Object.entries(fieldGroups).map(([groupKey, group]) => (
                  <View key={groupKey} style={styles.fieldGroup}>
                    <View style={styles.fieldGroupHeader}>
                      <Text style={[
                        styles.fieldGroupTitle,
                        { color: isDarkMode ? '#fff' : '#000' }
                      ]}>
                        {group.title}
                      </Text>

                      <View style={styles.fieldGroupActions}>
                        <TouchableOpacity
                          onPress={() => toggleGroup(groupKey, true)}>
                          <Text style={{ color: '#D55004', fontSize: 12 }}>
                            All
                          </Text>
                        </TouchableOpacity>

                        <Text style={{ color: isDarkMode ? '#666' : '#999', marginHorizontal: 4 }}>
                          |
                        </Text>

                        <TouchableOpacity
                          onPress={() => toggleGroup(groupKey, false)}>
                          <Text style={{ color: '#D55004', fontSize: 12 }}>
                            None
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.fieldsGrid}>
                      {group.fields.map(field => (
                        <View key={field.key} style={styles.fieldItem}>
                          <TouchableOpacity
                            style={styles.fieldCheckbox}
                            onPress={() => toggleField(groupKey, field.key)}>
                            <View style={[
                              styles.checkbox,
                              field.selected && styles.checkboxSelected,
                              { borderColor: isDarkMode ? '#fff' : '#000' }
                            ]}>
                              {field.selected && (
                                <Ionicons name="checkmark" size={16} color="#fff" />
                              )}
                            </View>

                            <Text style={[
                              styles.fieldLabel,
                              { color: isDarkMode ? '#fff' : '#000' }
                            ]}>
                              {field.label}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Step 3: Format Options */}
            {step === 3 && (
              <View>
                <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                  Export Options
                </Text>

                <Text style={[styles.sectionSubtitle, { color: isDarkMode ? '#ccc' : '#666' }]}>
                  Format
                </Text>
                <View style={styles.formatOptions}>
                  {EXPORT_FORMATS.map(format => (
                    <TouchableOpacity
                      key={format.value}
                      style={[
                        styles.formatOption,
                        exportFormat === format.value && styles.selectedFormat,
                        { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
                      ]}
                      onPress={() => setExportFormat(format.value)}>
                      <MaterialCommunityIcons
                        name={format.icon}
                        size={24}
                        color={exportFormat === format.value ? '#D55004' : isDarkMode ? '#fff' : '#000'}
                      />
                      <Text style={[
                        styles.formatLabel,
                        { color: isDarkMode ? '#fff' : '#000' },
                        exportFormat === format.value && { color: '#D55004' }
                      ]}>
                        {format.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.optionsContainer}>
                  <View style={styles.optionItem}>
                    <Text style={[styles.optionLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                      Include Header Row
                    </Text>
                    <Switch
                      value={includeHeaderRow}
                      onValueChange={setIncludeHeaderRow}
                      trackColor={{ false: '#767577', true: '#D55004' }}
                      thumbColor={includeHeaderRow ? '#f4f3f4' : '#f4f3f4'}
                    />
                  </View>

                  <View style={styles.optionItem}>
                    <Text style={[styles.optionLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                      Include Summary Statistics
                    </Text>
                    <Switch
                      value={includeSummary}
                      onValueChange={setIncludeSummary}
                      trackColor={{ false: '#767577', true: '#D55004' }}
                      thumbColor={includeSummary ? '#f4f3f4' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={styles.exportDataSummary}>
                  <Text style={[styles.summaryTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                    Export Summary
                  </Text>

                  <Text style={[styles.summaryItem, { color: isDarkMode ? '#ccc' : '#666' }]}>
                    • Date Range: {selectedRange === 'custom'
                        ? `${format(customStartDate, 'MMM d, yyyy')} to ${format(customEndDate, 'MMM d, yyyy')}`
                        : selectedRange === 'all'
                          ? 'All Time'
                          : `Last ${selectedRange} Month${selectedRange > 1 ? 's' : ''}`}
                  </Text>

                  <Text style={[styles.summaryItem, { color: isDarkMode ? '#ccc' : '#666' }]}>
                    • Fields: {selectedFields.length} selected
                  </Text>

                  {filterMake && (
                    <Text style={[styles.summaryItem, { color: isDarkMode ? '#ccc' : '#666' }]}>
                      • Make Filter: {filterMake}
                    </Text>
                  )}

                  {(filterMinProfit || filterMaxProfit) && (
                    <Text style={[styles.summaryItem, { color: isDarkMode ? '#ccc' : '#666' }]}>
                      • Profit Range: {filterMinProfit ? `$${filterMinProfit}` : '$0'} to {filterMaxProfit ? `$${filterMaxProfit}` : 'unlimited'}
                    </Text>
                  )}

                  <Text style={[styles.summaryItem, { color: isDarkMode ? '#ccc' : '#666' }]}>
                    • Format: {EXPORT_FORMATS.find(f => f.value === exportFormat)?.label}
                  </Text>

                  <Text style={[styles.summaryItem, { color: isDarkMode ? '#ccc' : '#666' }]}>
                    • Records: {getFilteredData().length} vehicles
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.exportButton,
                    isExporting && { opacity: 0.7 }
                  ]}
                  onPress={handleExport}
                  disabled={isExporting || selectedFields.length === 0}>
                  {isExporting ? (
                    <View style={styles.exportingContainer}>
                      <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                      <Text style={styles.exportButtonText}>
                        {exportSuccess ? 'Export Complete!' : 'Exporting...'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.exportingContainer}>
                      <MaterialCommunityIcons name="export" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.exportButtonText}>
                        Export {getFilteredData().length} Records
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isExporting && (
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${exportProgress}%` }]} />
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom Navigation */}
          <View style={styles.navigationContainer}>
            {step > 1 && (
              <TouchableOpacity
                style={[
                  styles.navigationButton,
                  { backgroundColor: isDarkMode ? '#333' : '#f0f0f0' }
                ]}
                onPress={prevStep}>
                <Ionicons name="chevron-back" size={18} color={isDarkMode ? '#fff' : '#000'} />
                <Text style={{ color: isDarkMode ? '#fff' : '#000', marginLeft: 4 }}>
                  Back
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.navigationButton,
                styles.primaryNavigationButton,
                selectedFields.length === 0 && step === 3 && { opacity: 0.5 }
              ]}
              onPress={nextStep}
              disabled={selectedFields.length === 0 && step === 3}>
              <Text style={{ color: '#fff', marginRight: 4 }}>
                {step === 3 ? 'Export' : 'Next'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    margin: 16,
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    marginBottom: Platform.OS === 'ios' ? 40 : 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)'
  },
  closeButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  nextButton: {
    padding: 4
  },
  stepsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between'
  },
  stepItem: {
    alignItems: 'center',
    width: '30%'
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  activeStepCircle: {
    backgroundColor: '#D55004'
  },
  stepNumber: {
    color: '#fff',
    fontWeight: 'bold'
  },
  stepLabel: {
    fontSize: 12,
    textAlign: 'center'
  },
  activeStepLabel: {
    fontWeight: 'bold'
  },
  modalContent: {
    flex: 1,
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 8
  },
  timeRangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  timeRangeOption: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  selectedTimeRange: {
    borderWidth: 1,
    borderColor: '#D55004'
  },
  timeRangeLabel: {
    fontWeight: '500'
  },
  customDateContainer: {
    marginTop: 10,
    marginBottom: 20
  },
  dateLabel: {
    marginBottom: 10,
    fontWeight: '500'
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  datePickerButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center'
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10
  },
  filtersContainer: {
    marginTop: 10,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 16,
    borderRadius: 8
  },
  filterItem: {
    marginBottom: 12
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  filterLabel: {
    marginBottom: 6,
    fontWeight: '500'
  },
  filterInput: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.3)'
  },
  fieldSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  fieldSelectActions: {
    flexDirection: 'row'
  },
  fieldSelectAction: {
    marginLeft: 12
  },
  fieldGroup: {
    marginBottom: 20
  },
  fieldGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  fieldGroupTitle: {
    fontWeight: '600'
  },
  fieldGroupActions: {
    flexDirection: 'row'
  },
  fieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  fieldItem: {
    width: '50%',
    marginBottom: 10
  },
  fieldCheckbox: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxSelected: {
    backgroundColor: '#D55004',
    borderColor: '#D55004'
  },
  fieldLabel: {
    fontSize: 14
  },
  formatOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  formatOption: {
    width: '30%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedFormat: {
    borderWidth: 1,
    borderColor: '#D55004'
  },
  formatLabel: {
    marginTop: 6,
    fontWeight: '500'
  },
  optionsContainer: {
    marginBottom: 20
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)'
  },
  optionLabel: {
    fontWeight: '500'
  },
  exportDataSummary: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20
  },
  summaryTitle: {
    fontWeight: '600',
    marginBottom: 10
  },
  summaryItem: {
    marginBottom: 6
  },
  exportButton: {
    backgroundColor: '#D55004',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  exportingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#D55004'
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    padding: 16
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  primaryNavigationButton: {
    backgroundColor: '#D55004',
    marginLeft: 'auto'
  }
})

export default ExportSalesModal