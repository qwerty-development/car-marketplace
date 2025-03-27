import { StyleSheet, Dimensions } from "react-native";
const {width} = Dimensions.get('window')

const styles = StyleSheet.create({
    // Main container styles
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    placeholderRight: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
  
    // Loading state styles
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
  
    // Car selection styles
    carSelectionContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    carSelectionCard: {
      width: width * 0.42,
      height: 180,
      borderRadius: 16,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    vsContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 10,
    },
    vsCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    vsText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
    },
    emptyCarSlot: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyCarText: {
      marginTop: 8,
      fontSize: 16,
      fontWeight: '500',
    },
    selectedCarContainer: {
      width: '100%',
      height: '100%',
    },
    selectedCarImage: {
      width: '100%',
      height: '65%',
    },
    selectedCarInfo: {
      padding: 8,
    },
    selectedCarMake: {
      fontWeight: 'bold',
      fontSize: 16,
      marginBottom: 2,
    },
    selectedCarModel: {
      fontSize: 14,
      marginBottom: 2,
    },
    selectedCarYear: {
      fontSize: 12,
    },
    clearButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      zIndex: 5,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 15,
      padding: 2,
    },
  
    // Placeholder and empty state styles
    placeholderContainer: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 40,
    },
    placeholderContent: {
      padding: 20,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    placeholderTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    placeholderText: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 16,
      lineHeight: 20,
    },
    addFavoritesButton: {
      backgroundColor: '#D55004',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 24,
      marginTop: 8,
      elevation: 2,
    },
    addFavoritesButtonText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 14,
    },
  
    // Comparison content styles
    comparisonContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    comparisonSection: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    comparisonGrid: {
      width: '100%',
    },
    comparisonHeader: {
      flexDirection: 'row',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.2)',
    },
    headerSpacer: {
      flex: 1,
    },
    carHeader: {
      width: '35%',
      fontWeight: '500',
      fontSize: 14,
      textAlign: 'center',
    },
  
    // Comparison row styles
    comparisonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    attributeLabelContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    attributeIcon: {
      marginRight: 8,
    },
    attributeLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    valuesContainer: {
      flexDirection: 'row',
      width: '70%',
    },
    valueCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      borderRadius: 8,
      marginHorizontal: 4,
      position: 'relative',
      height: 45,
    },
    betterValueCell: {
      borderWidth: 1,
      borderColor: '#4ADE80',
    },
    valueText: {
      fontSize: 13,
      fontWeight: '500',
    },
    betterValueText: {
      fontWeight: 'bold',
    },
    betterIndicator: {
      position: 'absolute',
      top: 4,
      right: 4,
    },
    progressBarContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 4,
      backgroundColor: 'rgba(150,150,150,0.2)',
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
    },
  
    // Feature header styles
    featureHeader: {
      flexDirection: 'row',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.2)',
    },
    featureHeaderLeft: {
      flex: 2,
      paddingLeft: 8,
    },
    featureHeaderText: {
      fontWeight: 'bold',
      fontSize: 14,
    },
    featureHeaderRight: {
      flex: 1,
      flexDirection: 'row',
    },
    featureHeaderCarName: {
      flex: 1,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '500',
    },
  
    // Feature comparison styles
    featureComparisonContainer: {
      paddingTop: 8,
    },
    featureRow: {
      flexDirection: 'row',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.1)',
      paddingLeft: 6,
    },
    featureInfo: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingLeft: 8,
    },
    featureTextContainer: {
      marginLeft: 12,
      flex: 1,
    },
    featureLabel: {
      fontWeight: '500',
      fontSize: 14,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 12,
      lineHeight: 16,
    },
    featureAvailability: {
      flex: 1,
      flexDirection: 'row',
    },
    featureCheckContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  
    // Summary component styles
    summaryContainer: {
      padding: 8,
    },
    summaryTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    summaryContent: {
      marginTop: 8,
    },
    recommendationBox: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    recommendationTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    recommendedCarName: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    recommendationReason: {
      fontSize: 14,
      lineHeight: 20,
    },
    insightBox: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    insightTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginVertical: 8,
    },
    insightText: {
      fontSize: 14,
      lineHeight: 20,
    },
  
    // Pros & Cons styles
    prosConsContainer: {
      marginBottom: 16,
    },
    prosConsTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    prosConsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    prosConsCard: {
      width: '48%',
      borderRadius: 12,
      padding: 12,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    prosConsCardTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    prosSection: {
      marginBottom: 12,
    },
    consSection: {
      marginBottom: 4,
    },
    proTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 6,
    },
    conTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 6,
    },
    proConItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    proConIcon: {
      marginTop: 2,
      marginRight: 4,
    },
    proConText: {
      fontSize: 12,
      flex: 1,
      lineHeight: 16,
    },
    noProsCons: {
      fontSize: 12,
      fontStyle: 'italic',
    },
  
    // Use cases styles
    useCasesContainer: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    useCasesTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    useCasesContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    useCaseColumn: {
      width: '48%',
    },
    useCaseCarName: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    useCaseItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    useCaseIcon: {
      marginTop: 2,
      marginRight: 4,
    },
    useCaseText: {
      fontSize: 12,
      flex: 1,
      lineHeight: 16,
    },
    noUseCases: {
      fontSize: 12,
      fontStyle: 'italic',
      textAlign: 'center',
    },
  
    // Image gallery styles
    imageGalleryContainer: {
      marginBottom: 16,
      padding: 12,
      borderRadius: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.03)',
    },
    galleryTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
      textAlign: 'center',
    },
    imagesContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    singleImageContainer: {
      width: '48%',
      alignItems: 'center',
    },
    comparisonImage: {
      width: '100%',
      height: 120,
      borderRadius: 8,
    },
    imageCarLabel: {
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },
    noImagePlaceholder: {
      width: '100%',
      height: 120,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    galleryControls: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    galleryButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    galleryCounter: {
      marginHorizontal: 16,
      fontSize: 14,
    },
  
    // Radar chart styles
    radarChartContainer: {
      margin: 8,
      marginBottom: 16,
      padding: 8,
      borderRadius: 16,
    },
    radarChartTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    radarChartContent: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  
    // Cost of ownership styles
    costComparisonContainer: {
      marginBottom: 16,
      padding: 12,
      borderRadius: 12,
    },
    costHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    costTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      flex: 1,
    },
    infoButton: {
      padding: 4,
    },
    costCards: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    costCard: {
      width: '48%',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    betterCostCard: {
      borderWidth: 1,
      borderColor: '#4ADE80',
    },
    costCardTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    costAmount: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    savingsBadge: {
      backgroundColor: '#4ADE80',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 4,
    },
    savingsText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    costInsight: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    costInsightText: {
      fontSize: 13,
      lineHeight: 18,
    },
    costDisclaimer: {
      fontSize: 10,
      fontStyle: 'italic',
    },
  
    // Empty states
    emptyFeaturesContainer: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyFeaturesText: {
      fontSize: 14,
      textAlign: 'center',
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
      minHeight: 200,
    },
    emptyStateText: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 16,
    },
  
    // Modal styles
    modalBlurContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
    },
    modalHeader: {
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.2)',
      position: 'relative',
    },
    modalHandleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(150,150,150,0.5)',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    closeButton: {
      position: 'absolute',
      right: 16,
      top: 12,
    },
  
    // Search and sort styles
    searchSortContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.2)',
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      marginLeft: 8,
      paddingVertical: 0,
    },
    sortContainer: {
      marginTop: 4,
    },
    sortLabel: {
      fontSize: 14,
      marginBottom: 8,
    },
    sortOptionsContainer: {
      paddingVertical: 4,
    },
    sortOption: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
    },
    sortOptionActive: {
      backgroundColor: '#D55004',
    },
    sortOptionText: {
      fontSize: 12,
      fontWeight: '500',
    },
  
    // Car list styles
    carList: {
      padding: 16,
    },
    carItem: {
      flexDirection: 'row',
      marginBottom: 12,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: 1,
    },
    carThumbnail: {
      width: 90,
      height: 90,
    },
    carInfo: {
      flex: 1,
      padding: 12,
    },
    carMake: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 2,
    },
    carTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    carPrice: {
      fontSize: 15,
      fontWeight: '500',
      marginBottom: 4,
    },
    carMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    carMetaItem: {
      fontSize: 12,
      marginRight: 12,
    },
    featureCountBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    featureCountText: {
      fontSize: 11,
      marginLeft: 3,
    },
    alreadySelectedBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    alreadySelectedText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 14,
    },
  
    // Share button
    shareButtonContainer: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 10,
    },
    shareButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#D55004',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
    },
  
    // Tab navigation
    tabContainer: {
      flexDirection: 'row',
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
    },
    tabText: {
      fontWeight: '500',
      fontSize: 14,
    },
  
    // Value comparison chart
    valueChartContainer: {
      padding: 12,
      marginBottom: 16,
      borderRadius: 12,
    },
    valueChartTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
      textAlign: 'center',
    },
    valueMetricsContainer: {
      marginTop: 8,
    },
    valueMetricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(150,150,150,0.1)',
    },
    valueMetricLabel: {
      width: '30%',
      fontSize: 13,
      fontWeight: '500',
    },
    valueMetricBars: {
      flex: 1,
      flexDirection: 'row',
      height: 24,
      position: 'relative',
    },
    valueBar1: {
      height: '100%',
      borderTopLeftRadius: 4,
      borderBottomLeftRadius: 4,
      position: 'absolute',
      left: 0,
    },
    valueBar2: {
      height: '100%',
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
      position: 'absolute',
      right: 0,
    },
    valueScoreText: {
      position: 'absolute',
      fontSize: 11,
      fontWeight: 'bold',
      color: 'white',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    valueScore1: {
      left: 4,
    },
    valueScore2: {
      right: 4,
    },
    valueBarLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    valueBarLabel: {
      fontSize: 10,
    },
    valueChartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 16,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 8,
    },
    legendColor: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 4,
    },
    legendText: {
      fontSize: 12,
    },

    costBreakdownContainer: {
      marginTop: 16,
      borderRadius: 8,
      padding: 16,
    },
    costBreakdownTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    costBreakdownHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#333333',
    },
    costBreakdownRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: '#333333',
    },
    costBreakdownCategory: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
    },
    costBreakdownValue: {
      flex: 1,
      justifyContent: 'center',
    },
    costBreakdownTotal: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#444444',
    },
  
    // TextInput
    textInput: {
      padding: 0,
    },
  });

  export default styles;