import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/utils/supabase';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { useLanguage } from '@/utils/LanguageContext';
import {
  useWalletPurchase,
  fetchActivePackages,
  packagesForItemType,
  PricingPackage,
} from '@/hooks/useWalletPurchase';

interface Region {
  code: string;
  name_en: string;
  name_ar: string;
  sort: number;
}

interface CarRequestFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

const fetchRegions = async (): Promise<Region[]> => {
  const { data, error } = await supabase
    .from('regions')
    .select('*')
    .order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Region[];
};

const fetchMakes = async (): Promise<string[]> => {
  const makes = new Set<string>();
  const batch = 1000;
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabase
      .from('allcars')
      .select('make')
      .range(page * batch, (page + 1) * batch - 1)
      .order('make');
    if (error) throw error;
    if (!data || data.length === 0) break;
    data.forEach((row: any) => {
      if (row.make && typeof row.make === 'string' && row.make.trim()) {
        makes.add(row.make.trim());
      }
    });
    if (data.length < batch) break;
  }
  return Array.from(makes).sort();
};

/**
 * Car request creation form (US-01): make (required), model, year range,
 * budget range, notes, region (incl. All of Lebanon). Quota handling: when
 * create_car_request returns 'payment_required' (2 free/month used up), shows
 * car_request packages and retries after a successful Whish purchase.
 */
export default function CarRequestFormModal({
  visible,
  onClose,
  onSubmitted,
}: CarRequestFormModalProps) {
  const { isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const isRTL = I18nManager.isRTL;
  const { purchasePackage, purchasingPkgId, polling } = useWalletPurchase();

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [notes, setNotes] = useState('');
  const [region, setRegion] = useState('all_lebanon');
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset the form each time the sheet opens
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setMake('');
      setModel('');
      setYearMin('');
      setYearMax('');
      setBudgetMin('');
      setBudgetMax('');
      setNotes('');
      setRegion('all_lebanon');
      setShowPackages(false);
      setShowMakeSuggestions(false);
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: fetchRegions,
    enabled: visible,
    staleTime: Infinity,
  });

  const { data: makes } = useQuery<string[]>({
    queryKey: ['allcars', 'makes'],
    queryFn: fetchMakes,
    enabled: visible,
    staleTime: Infinity,
  });

  const { data: packages } = useQuery<PricingPackage[]>({
    queryKey: ['pricing_packages'],
    queryFn: fetchActivePackages,
    enabled: visible && showPackages,
  });

  const role = profile?.role === 'dealer' ? 'dealer' : 'user';
  const requestPackages = packagesForItemType(packages, 'car_request', role);

  const makeSuggestions = useMemo(() => {
    if (!makes || !make.trim() || !showMakeSuggestions) return [];
    const q = make.trim().toLowerCase();
    return makes.filter((m) => m.toLowerCase().includes(q)).slice(0, 6);
  }, [makes, make, showMakeSuggestions]);

  const selectedRegion = (regions ?? []).find((r) => r.code === region);
  const regionLabel = selectedRegion
    ? language === 'ar'
      ? selectedRegion.name_ar
      : selectedRegion.name_en
    : t('requests.allLebanon');

  const validate = useCallback((): string | null => {
    if (!make.trim()) return t('requests.makeRequired');
    const yMin = yearMin ? parseInt(yearMin, 10) : null;
    const yMax = yearMax ? parseInt(yearMax, 10) : null;
    if (yMin !== null && (Number.isNaN(yMin) || yMin < 1900 || yMin > 2100)) {
      return t('requests.invalidYear');
    }
    if (yMax !== null && (Number.isNaN(yMax) || yMax < 1900 || yMax > 2100)) {
      return t('requests.invalidYear');
    }
    if (yMin !== null && yMax !== null && yMin > yMax) return t('requests.invalidYearRange');
    const bMin = budgetMin ? Number(budgetMin) : null;
    const bMax = budgetMax ? Number(budgetMax) : null;
    if ((bMin !== null && Number.isNaN(bMin)) || (bMax !== null && Number.isNaN(bMax))) {
      return t('requests.invalidBudget');
    }
    if (bMin !== null && bMax !== null && bMin > bMax) return t('requests.invalidBudgetRange');
    return null;
  }, [make, yearMin, yearMax, budgetMin, budgetMax, t]);

  const submitRequest = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc('create_car_request', {
      p_make: make.trim(),
      p_model: model.trim() || null,
      p_year_min: yearMin ? parseInt(yearMin, 10) : null,
      p_year_max: yearMax ? parseInt(yearMax, 10) : null,
      p_budget_min: budgetMin ? Number(budgetMin) : null,
      p_budget_max: budgetMax ? Number(budgetMax) : null,
      p_notes: notes.trim() || null,
      p_region: region,
    });
    if (error) throw error;

    if (data?.success) {
      Toast.show({ type: 'success', text1: t('requests.submitted') });
      queryClient.invalidateQueries({ queryKey: ['car_requests'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      onSubmitted?.();
      onClose();
      return true;
    }

    if (data?.reason === 'payment_required') {
      setShowPackages(true);
      Toast.show({
        type: 'info',
        text1: t('requests.quotaReached', { count: Number(data?.free_limit ?? 2) }),
      });
    } else if (data?.reason === 'invalid_region') {
      Toast.show({ type: 'error', text1: t('requests.invalidRegion') });
    } else if (data?.reason === 'make_required') {
      Toast.show({ type: 'error', text1: t('requests.makeRequired') });
    } else {
      Toast.show({ type: 'error', text1: t('requests.submitFailed') });
    }
    return false;
  }, [make, model, yearMin, yearMax, budgetMin, budgetMax, notes, region, t, queryClient, onSubmitted, onClose]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      Toast.show({ type: 'error', text1: validationError });
      return;
    }
    setSubmitting(true);
    try {
      await submitRequest();
    } catch (error) {
      console.error('create_car_request failed:', error);
      Toast.show({ type: 'error', text1: t('requests.submitFailed') });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [submitting, validate, submitRequest, t]);

  const handleBuyPackage = useCallback(
    async (pkg: PricingPackage) => {
      const outcome = await purchasePackage(pkg.id);
      if (!mountedRef.current) return;
      if (outcome === 'paid') {
        Toast.show({ type: 'success', text1: t('requests.purchaseSuccess') });
        setShowPackages(false);
        // Retry the submission with the freshly purchased request item.
        setSubmitting(true);
        try {
          await submitRequest();
        } catch (error) {
          console.error('create_car_request retry failed:', error);
          Toast.show({ type: 'error', text1: t('requests.submitFailed') });
        } finally {
          if (mountedRef.current) setSubmitting(false);
        }
      } else if (outcome === 'pending') {
        Toast.show({ type: 'info', text1: t('requests.paymentPending') });
      } else {
        Toast.show({ type: 'error', text1: t('requests.paymentFailed') });
      }
    },
    [purchasePackage, submitRequest, t]
  );

  if (!user?.id) return null;

  const busy = submitting || purchasingPkgId !== null || polling;
  const inputClass = `rounded-xl px-4 py-3 text-base ${
    isDarkMode ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-black'
  }`;
  const labelClass = `text-sm font-semibold mb-1 mt-3 ${
    isDarkMode ? 'text-neutral-300' : 'text-neutral-700'
  }`;
  const textAlign = isRTL ? ('right' as const) : ('left' as const);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={busy ? undefined : onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-black/50"
          onPress={busy ? undefined : onClose}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            className={`rounded-t-3xl ${isDarkMode ? 'bg-neutral-900' : 'bg-white'} px-5 pt-5 pb-8`}
            style={{ maxHeight: '88%' }}
          >
            {/* Header */}
            <View
              className="items-center justify-between mb-2"
              style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <View
                className="items-center"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
              >
                <Ionicons
                  name="search-circle"
                  size={24}
                  color="#D55004"
                  style={isRTL ? { marginLeft: 8 } : { marginRight: 8 }}
                />
                <Text className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {t('requests.newRequest')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                disabled={busy}
                className="p-1"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            </View>

            {polling ? (
              <View className="py-10 items-center">
                <ActivityIndicator size="large" color="#D55004" />
                <Text className={`mt-4 text-sm ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                  {t('requests.paymentPending')}
                </Text>
              </View>
            ) : showPackages ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text
                  className={`text-sm mb-3 ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}
                  style={{ textAlign }}
                >
                  {t('requests.choosePackage')}
                </Text>
                {requestPackages.length === 0 ? (
                  <Text className={`text-center py-6 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {t('requests.noPackages')}
                  </Text>
                ) : (
                  requestPackages.map((pkg) => (
                    <TouchableOpacity
                      key={pkg.id}
                      onPress={() => handleBuyPackage(pkg)}
                      disabled={busy}
                      className={`rounded-2xl border p-4 mb-3 ${
                        isDarkMode ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'
                      }`}
                      style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        opacity: busy && purchasingPkgId !== pkg.id ? 0.5 : 1,
                      }}
                    >
                      <View className="flex-1">
                        <Text
                          className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}
                          style={{ textAlign }}
                        >
                          {language === 'ar' && pkg.name_ar ? pkg.name_ar : pkg.name}
                        </Text>
                        <View
                          className="items-center mt-1"
                          style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
                        >
                          <Text className="text-red font-bold text-base">
                            ${Number(pkg.price_usd).toFixed(2)}
                          </Text>
                          {pkg.compare_at_price_usd != null &&
                            Number(pkg.compare_at_price_usd) > Number(pkg.price_usd) && (
                              <Text
                                className={`text-xs mx-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}
                                style={{ textDecorationLine: 'line-through' }}
                              >
                                ${Number(pkg.compare_at_price_usd).toFixed(2)}
                              </Text>
                            )}
                        </View>
                      </View>
                      {purchasingPkgId === pkg.id ? (
                        <ActivityIndicator size="small" color="#D55004" />
                      ) : (
                        <View className="bg-red rounded-full px-4 py-2">
                          <Text className="text-white text-sm font-bold">
                            {t('requests.buyPackage')}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity onPress={() => setShowPackages(false)} className="py-3 items-center">
                  <Text className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Make (required) with suggestions */}
                <Text className={labelClass} style={{ textAlign }}>
                  {t('requests.make')} *
                </Text>
                <TextInput
                  value={make}
                  onChangeText={(v) => {
                    setMake(v);
                    setShowMakeSuggestions(true);
                  }}
                  placeholder={t('requests.makePlaceholder')}
                  placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
                  className={inputClass}
                  style={{ textAlign }}
                  editable={!busy}
                />
                {makeSuggestions.length > 0 && (
                  <View
                    className={`rounded-xl mt-1 overflow-hidden ${
                      isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'
                    }`}
                  >
                    {makeSuggestions.map((m) => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => {
                          setMake(m);
                          setShowMakeSuggestions(false);
                        }}
                        className={`px-4 py-3 border-b ${
                          isDarkMode ? 'border-neutral-700' : 'border-neutral-200'
                        }`}
                      >
                        <Text
                          className={isDarkMode ? 'text-white' : 'text-black'}
                          style={{ textAlign }}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Model */}
                <Text className={labelClass} style={{ textAlign }}>
                  {t('requests.model')}
                </Text>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder={t('requests.modelPlaceholder')}
                  placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
                  className={inputClass}
                  style={{ textAlign }}
                  editable={!busy}
                />

                {/* Year range */}
                <Text className={labelClass} style={{ textAlign }}>
                  {t('requests.yearRange')}
                </Text>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
                  <TextInput
                    value={yearMin}
                    onChangeText={setYearMin}
                    placeholder={t('requests.from')}
                    placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
                    keyboardType="number-pad"
                    maxLength={4}
                    className={inputClass}
                    style={{ flex: 1, textAlign }}
                    editable={!busy}
                  />
                  <TextInput
                    value={yearMax}
                    onChangeText={setYearMax}
                    placeholder={t('requests.to')}
                    placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
                    keyboardType="number-pad"
                    maxLength={4}
                    className={inputClass}
                    style={{ flex: 1, textAlign }}
                    editable={!busy}
                  />
                </View>

                {/* Budget range */}
                <Text className={labelClass} style={{ textAlign }}>
                  {t('requests.budgetRange')}
                </Text>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
                  <TextInput
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                    placeholder={t('requests.minUsd')}
                    placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
                    keyboardType="numeric"
                    className={inputClass}
                    style={{ flex: 1, textAlign }}
                    editable={!busy}
                  />
                  <TextInput
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    placeholder={t('requests.maxUsd')}
                    placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
                    keyboardType="numeric"
                    className={inputClass}
                    style={{ flex: 1, textAlign }}
                    editable={!busy}
                  />
                </View>

                {/* Region */}
                <Text className={labelClass} style={{ textAlign }}>
                  {t('requests.region')}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowRegionPicker(true)}
                  disabled={busy}
                  className={inputClass}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text className={isDarkMode ? 'text-white' : 'text-black'}>{regionLabel}</Text>
                  <Ionicons name="chevron-down" size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>

                {/* Notes */}
                <Text className={labelClass} style={{ textAlign }}>
                  {t('requests.notes')}
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('requests.notesPlaceholder')}
                  placeholderTextColor={isDarkMode ? '#737373' : '#A3A3A3'}
                  multiline
                  numberOfLines={3}
                  className={inputClass}
                  style={{ minHeight: 72, textAlignVertical: 'top', textAlign }}
                  editable={!busy}
                />

                {/* Submit */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={busy}
                  className="bg-red py-4 rounded-xl items-center mt-5"
                  style={{ opacity: busy ? 0.6 : 1 }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-white font-bold text-base">
                      {t('requests.submit')}
                    </Text>
                  )}
                </TouchableOpacity>
                <Text
                  className={`text-xs text-center mt-3 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}
                >
                  {t('requests.expiryNote')}
                </Text>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Region picker overlay */}
        <Modal visible={showRegionPicker} transparent animationType="fade">
          <Pressable
            className="flex-1 bg-black/50 justify-center px-8"
            onPress={() => setShowRegionPicker(false)}
          >
            <View className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}>
              {(regions ?? []).map((r) => (
                <TouchableOpacity
                  key={r.code}
                  onPress={() => {
                    setRegion(r.code);
                    setShowRegionPicker(false);
                  }}
                  className={`px-5 py-4 border-b ${
                    isDarkMode ? 'border-neutral-800' : 'border-neutral-100'
                  }`}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    className={`text-base ${
                      region === r.code
                        ? 'text-red font-bold'
                        : isDarkMode
                        ? 'text-white'
                        : 'text-black'
                    }`}
                  >
                    {language === 'ar' ? r.name_ar : r.name_en}
                  </Text>
                  {region === r.code && <Ionicons name="checkmark" size={20} color="#D55004" />}
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}
