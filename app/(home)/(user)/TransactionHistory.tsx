// app/(home)/(user)/TransactionHistory.tsx
// Transaction history screen for credit purchases and usage

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { useAuth } from '@/utils/AuthContext';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'expo-router';

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'purchase' | 'deduction' | 'refund' | 'admin_grant';
  description: string;
  metadata: any;
  created_at: string;
}

export default function TransactionHistory() {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions();
  }, [fetchTransactions]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return { name: 'add-circle', color: '#10b981' };
      case 'deduction':
        return { name: 'remove-circle', color: '#ef4444' };
      case 'refund':
        return { name: 'arrow-undo', color: '#3b82f6' };
      case 'admin_grant':
        return { name: 'gift', color: '#f59e0b' };
      default:
        return { name: 'help-circle', color: '#6b7280' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const icon = getTransactionIcon(item.transaction_type);
    const isPositive = item.transaction_type === 'purchase' || item.transaction_type === 'refund' || item.transaction_type === 'admin_grant';

    return (
      <View
        className={`mx-4 mb-3 p-4 rounded-xl ${
          isDarkMode ? 'bg-neutral-800' : 'bg-neutral-100'
        }`}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${icon.color}20` }}
            >
              <Ionicons name={icon.name as any} size={22} color={icon.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className={`font-semibold text-base ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}
                numberOfLines={2}
              >
                {item.description}
              </Text>
              <Text
                className={`text-xs mt-1 ${
                  isDarkMode ? 'text-white/60' : 'text-gray-500'
                }`}
              >
                {formatDate(item.created_at)}
              </Text>
            </View>
          </View>
          <Text
            className={`text-lg font-bold ${
              isPositive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isPositive ? '+' : ''}
            {item.amount}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons
        name="receipt-outline"
        size={64}
        color={isDarkMode ? '#6b7280' : '#9ca3af'}
      />
      <Text
        className={`text-lg font-semibold mt-4 ${
          isDarkMode ? 'text-white/60' : 'text-gray-500'
        }`}
      >
        No transactions yet
      </Text>
      <Text
        className={`text-sm mt-2 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}
      >
        Your credit history will appear here
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
      >
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#D55004" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
      edges={['top']}
    >
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 items-center justify-center"
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? '#fff' : '#000'}
          />
        </TouchableOpacity>
        <Text
          className={`text-xl font-bold ${
            isDarkMode ? 'text-white' : 'text-black'
          }`}
        >
          Transaction History
        </Text>
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDarkMode ? '#D55004' : '#D55004'}
            colors={['#D55004']}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
