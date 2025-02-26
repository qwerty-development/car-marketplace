import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Dimensions, TouchableOpacity } from 'react-native'
import { BarChart } from 'react-native-chart-kit'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// View modes for the chart
const VIEW_MODES = {
  COUNT: 'count',
  REVENUE: 'revenue',
  PROFIT: 'profit'
}

/**
 * Enhanced sales chart component with multiple view modes and insights
 * @param {Array} salesData - Array of sales data objects containing month, count, total
 * @param {boolean} isDarkMode - Whether dark mode is enabled
 */
const EnhancedSalesChart = ({ salesData, isDarkMode }) => {
  // State for the current view mode
  const [viewMode, setViewMode] = useState(VIEW_MODES.COUNT)

  // Process data for chart and insights
  const processedData = useMemo(() => {
    if (!salesData || salesData.length === 0) {
      return {
        chartData: {
          labels: [],
          datasets: [{ data: [] }]
        },
        metrics: {
          growthRate: 0,
          total: 0,
          average: 0,
          trend: 'none',
          totalRevenue: 0,
          totalProfit: 0,
          averageProfit: 0
        }
      }
    }

    // Get last 12 months or all if less than 12
    const last12Months = salesData.slice(-12)

    // Calculate metrics for each view mode

    // 1. Count metrics
    const currentMonthCount = last12Months[last12Months.length - 1]?.count || 0
    const previousMonthCount = last12Months[last12Months.length - 2]?.count || 0
    const countGrowthRate = previousMonthCount
      ? ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100
      : 0

    const totalCount = last12Months.reduce((sum, month) => sum + (month.count || 0), 0)
    const averageCount = totalCount / Math.max(1, last12Months.length)

    // 2. Revenue metrics
    const totalRevenue = last12Months.reduce((sum, month) => sum + (month.total || 0), 0)
    const averageRevenue = totalRevenue / Math.max(1, last12Months.length)

    const currentMonthRevenue = last12Months[last12Months.length - 1]?.total || 0
    const previousMonthRevenue = last12Months[last12Months.length - 2]?.total || 0
    const revenueGrowthRate = previousMonthRevenue
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : 0

    // 3. Profit metrics
    // Estimate profit as 25% of total if not provided
    const calculateProfit = (item) => {
      if (item.profit) return item.profit
      return item.total ? item.total * 0.25 : 0
    }

    const totalProfit = last12Months.reduce((sum, month) => sum + calculateProfit(month), 0)
    const averageProfit = totalProfit / Math.max(1, last12Months.length)

    const currentMonthProfit = calculateProfit(last12Months[last12Months.length - 1] || {})
    const previousMonthProfit = calculateProfit(last12Months[last12Months.length - 2] || {})
    const profitGrowthRate = previousMonthProfit
      ? ((currentMonthProfit - previousMonthProfit) / previousMonthProfit) * 100
      : 0

    // Prepare chart data for each view mode
    return {
      chartData: {
        count: {
          labels: last12Months.map(d => d.month),
          datasets: [{ data: last12Months.map(d => d.count || 0) }]
        },
        revenue: {
          labels: last12Months.map(d => d.month),
          datasets: [{ data: last12Months.map(d => (d.total || 0) / 1000) }] // Convert to K
        },
        profit: {
          labels: last12Months.map(d => d.month),
          datasets: [{ data: last12Months.map(d => calculateProfit(d) / 1000) }] // Convert to K
        }
      },
      metrics: {
        count: {
          current: currentMonthCount,
          previous: previousMonthCount,
          growthRate: countGrowthRate,
          total: totalCount,
          average: averageCount,
          trend: currentMonthCount > averageCount ? 'up' : 'down'
        },
        revenue: {
          current: currentMonthRevenue,
          previous: previousMonthRevenue,
          growthRate: revenueGrowthRate,
          total: totalRevenue,
          average: averageRevenue,
          trend: currentMonthRevenue > averageRevenue ? 'up' : 'down'
        },
        profit: {
          current: currentMonthProfit,
          previous: previousMonthProfit,
          growthRate: profitGrowthRate,
          total: totalProfit,
          average: averageProfit,
          trend: currentMonthProfit > averageProfit ? 'up' : 'down'
        }
      }
    }
  }, [salesData])

  // Get performance text based on growth rate
  const getPerformanceText = growthRate => {
    if (growthRate > 20) return 'Exceptional growth!'
    if (growthRate > 10) return 'Strong performance!'
    if (growthRate > 0) return 'Positive trend'
    if (growthRate === 0) return 'Stable performance'
    if (growthRate > -10) return 'Slight decline'
    return 'Needs attention'
  }

  // Chart configuration
  const chartConfig = {
    backgroundGradientFrom: isDarkMode ? '#1A1A1A' : '#FFFFFF',
    backgroundGradientTo: isDarkMode ? '#1A1A1A' : '#FFFFFF',
    backgroundColor: 'transparent',
    decimalPlaces: viewMode === VIEW_MODES.COUNT ? 0 : 1,
    color: (opacity = 1) => {
      // Create a modern gradient effect
      return isDarkMode
        ? `rgba(213, 80, 4, ${opacity})` // Orange for dark mode
        : `rgba(213, 80, 4, ${opacity})` // Orange for light mode
    },
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    propsForBackgroundLines: {
      strokeWidth: 1,
      strokeDasharray: '',
      stroke: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    },
    propsForLabels: {
      fontSize: 10,
      fontWeight: '600'
    }
  }

  // If no data, show empty state
  if (!salesData || salesData.length === 0) {
    return (
      <View className="rounded-3xl overflow-hidden mb-6">
        <BlurView
          intensity={isDarkMode ? 20 : 40}
          tint={isDarkMode ? 'dark' : 'light'}
          className="rounded-3xl">
          <View className="p-6 items-center justify-center">
            <Ionicons
              name="bar-chart-outline"
              size={50}
              color={isDarkMode ? '#555' : '#ccc'}
            />
            <Text
              className={`text-center mt-4 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
              No sales data available to display
            </Text>
          </View>
        </BlurView>
      </View>
    )
  }

  // Get current metrics based on view mode
  const currentMetrics = processedData.metrics[viewMode]
  const currentChartData = processedData.chartData[viewMode]

  // Format values based on view mode
  const formatValue = (value, mode) => {
    if (mode === VIEW_MODES.COUNT) return value.toLocaleString()
    return `$${value.toLocaleString()}`
  }

  const formatThousand = (value, mode) => {
    if (mode === VIEW_MODES.COUNT) return value.toLocaleString()
    return `$${Math.round(value / 1000)}k`
  }

  // Insight Card Component
  const InsightCard = ({ title, value, icon, trend, color, mode = viewMode }) => (
    <LinearGradient
      colors={
        isDarkMode
          ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
          : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)']
      }
      className="rounded-2xl p-4 flex-1 mx-1"
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}>
      <View className="flex-row justify-between items-center mb-2">
        <Text
          className={`text-xs ${
            isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
          }`}>
          {title}
        </Text>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text
        className={`text-lg font-bold ${
          isDarkMode ? 'text-white' : 'text-neutral-900'
        }`}>
        {formatValue(value, mode)}
      </Text>
      {trend !== undefined && (
        <View className="flex-row items-center mt-1">
          <Ionicons
            name={trend >= 0 ? 'trending-up' : 'trending-down'}
            size={14}
            color={trend >= 0 ? '#10B981' : '#EF4444'}
          />
          <Text
            className={`text-xs ml-1 ${
              trend >= 0 ? 'text-green-500' : 'text-pink-500'
            }`}>
            {Math.abs(trend).toFixed(1)}%
          </Text>
        </View>
      )}
    </LinearGradient>
  )

  // Performance Insight Component
  const PerformanceInsight = ({ metrics }) => (
    <LinearGradient
      colors={
        isDarkMode
          ? ['rgba(213, 80, 4, 0.2)', 'rgba(213, 80, 4, 0.1)']
          : ['rgba(213, 80, 4, 0.1)', 'rgba(213, 80, 4, 0.05)']
      }
      className="rounded-2xl p-4 mb-6">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text
            className={`text-xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-neutral-900'
            }`}>
            {getPerformanceText(metrics.growthRate)}
          </Text>
          <Text
            className={`text-sm ${
              isDarkMode ? 'text-neutral-400' : 'text-neutral-600'
            }`}>
            Your {viewMode === VIEW_MODES.COUNT ? 'sales' : viewMode} performance is{' '}
            <Text
              className={metrics.growthRate >= 0 ? 'text-green-500' : 'text-pink-500'}>
              {metrics.growthRate > 0 ? '+' : ''}
              {metrics.growthRate.toFixed(1)}%
            </Text>{' '}
            compared to last month
          </Text>
        </View>
        <View
          className={`rounded-full p-3 ${
            metrics.growthRate >= 0 ? 'bg-green-500/20' : 'bg-pink-500/20'
          }`}>
          <Ionicons
            name={metrics.growthRate >= 0 ? 'trending-up' : 'trending-down'}
            size={24}
            color={metrics.growthRate >= 0 ? '#10B981' : '#EF4444'}
          />
        </View>
      </View>
    </LinearGradient>
  )

  // View Mode Toggle Component
  const ViewModeToggle = () => (
    <View className="flex-row justify-center mb-6">
      <View
        className={`flex-row rounded-full p-1 ${
          isDarkMode ? 'bg-neutral-800' : 'bg-neutral-200'
        }`}>
        <TouchableOpacity
          className={`px-4 py-2 rounded-full ${
            viewMode === VIEW_MODES.COUNT
              ? isDarkMode ? 'bg-red' : 'bg-red'
              : 'bg-transparent'
          }`}
          onPress={() => setViewMode(VIEW_MODES.COUNT)}>
          <Text
            className={`font-medium ${
              viewMode === VIEW_MODES.COUNT
                ? 'text-white'
                : isDarkMode
                ? 'text-neutral-400'
                : 'text-neutral-600'
            }`}>
            Sales
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`px-4 py-2 rounded-full ${
            viewMode === VIEW_MODES.REVENUE
              ? isDarkMode ? 'bg-red' : 'bg-red'
              : 'bg-transparent'
          }`}
          onPress={() => setViewMode(VIEW_MODES.REVENUE)}>
          <Text
            className={`font-medium ${
              viewMode === VIEW_MODES.REVENUE
                ? 'text-white'
                : isDarkMode
                ? 'text-neutral-400'
                : 'text-neutral-600'
            }`}>
            Revenue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`px-4 py-2 rounded-full ${
            viewMode === VIEW_MODES.PROFIT
              ? isDarkMode ? 'bg-red' : 'bg-red'
              : 'bg-transparent'
          }`}
          onPress={() => setViewMode(VIEW_MODES.PROFIT)}>
          <Text
            className={`font-medium ${
              viewMode === VIEW_MODES.PROFIT
                ? 'text-white'
                : isDarkMode
                ? 'text-neutral-400'
                : 'text-neutral-600'
            }`}>
            Profit
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View className="mb-6">
      <BlurView
        intensity={isDarkMode ? 20 : 40}
        tint={isDarkMode ? 'dark' : 'light'}
        className="absolute inset-0 rounded-3xl"
      />

      <View className="p-4">
        <Text
          className={`text-xl font-bold mb-4 ${
            isDarkMode ? 'text-white' : 'text-neutral-900'
          }`}>
          Sales Overview
        </Text>

        {/* View Mode Toggle */}
        <ViewModeToggle />

        {/* Performance Insight Panel */}
        <PerformanceInsight metrics={currentMetrics} />

        {/* Metrics Cards */}
        <View className="flex-row mb-6">
          <InsightCard
            title={viewMode === VIEW_MODES.COUNT ? 'Monthly Average' : 'Average'}
            value={currentMetrics.average}
            icon="analytics"
            color="#0EA5E9"
          />
          <InsightCard
            title={viewMode === VIEW_MODES.COUNT ? 'Current Month' : 'Current'}
            value={currentMetrics.current}
            icon="pulse"
            trend={currentMetrics.growthRate}
            color="#10B981"
          />
        </View>

        {/* Chart Section */}
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={currentChartData}
              width={Math.max(
                SCREEN_WIDTH * 1.2,
                currentChartData.labels.length * 80
              )}
              height={220}
              chartConfig={chartConfig}
              showValuesOnTopOfBars={true}
              withInnerLines={true}
              segments={5}
              fromZero={true}
              yAxisLabel={viewMode !== VIEW_MODES.COUNT ? "$" : ""}
              yAxisSuffix={viewMode !== VIEW_MODES.COUNT ? "k" : ""}
              style={{
                borderRadius: 16,
                paddingTop: 12
              }}
            />
          </ScrollView>
        </View>

        {/* Summary Stats */}
        <View className="flex-row mt-6">
          <View
            className={`flex-1 p-4 mr-2 rounded-2xl ${
              isDarkMode ? 'bg-neutral-800/50' : 'bg-neutral-100'
            }`}>
            <Text
              className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-1`}>
              Total {viewMode === VIEW_MODES.COUNT ? 'Sales' : viewMode === VIEW_MODES.REVENUE ? 'Revenue' : 'Profit'}
            </Text>
            <Text
              className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {formatValue(currentMetrics.total, viewMode)}
            </Text>
          </View>

          <View
            className={`flex-1 p-4 rounded-2xl ${
              isDarkMode ? 'bg-neutral-800/50' : 'bg-neutral-100'
            }`}>
            <Text
              className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'} mb-1`}>
              Projected Next Month
            </Text>
            <Text
              className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {formatValue(
                Math.round(
                  currentMetrics.average *
                  (1 + currentMetrics.growthRate / 100)
                ),
                viewMode
              )}
            </Text>
          </View>
        </View>

        {/* Future Prediction Indicator */}
        <View className="mt-6 p-4 rounded-2xl bg-red/10">
          <Text
            className={`text-sm ${
              isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
            }`}>
            Based on current trends, next month's {viewMode} {viewMode === VIEW_MODES.COUNT ? 'are' : 'is'} projected to be{' '}
            <Text className="font-bold text-red">
              {formatThousand(
                Math.round(
                  currentMetrics.average *
                  (1 + currentMetrics.growthRate / 100)
                ),
                viewMode
              )}
              {viewMode === VIEW_MODES.COUNT ? ' cars' : ''}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  )
}

export default EnhancedSalesChart