// utils/CreditContext.tsx
// Credit system context provider

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

interface CreditContextProps {
  creditBalance: number;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  deductCredits: (amount: number, purpose: string, carId?: number) => Promise<boolean>;
}

const CreditContext = createContext<CreditContextProps | undefined>(undefined);

export const useCredits = () => {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
};

export const CreditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSignedIn } = useAuth();
  const [creditBalance, setCreditBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch credit balance
  const refreshBalance = useCallback(async () => {
    if (!user?.id || !isSignedIn) {
      setCreditBalance(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('credit_balance')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching credit balance:', error);
        setCreditBalance(0);
      } else {
        setCreditBalance(data?.credit_balance || 0);
      }
    } catch (error) {
      console.error('Error in refreshBalance:', error);
      setCreditBalance(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isSignedIn]);

  // Deduct credits (optimistic update)
  const deductCredits = useCallback(async (amount: number, purpose: string, carId?: number): Promise<boolean> => {
    if (!user?.id) return false;

    const previousBalance = creditBalance;

    try {
      // Optimistic update
      setCreditBalance(prev => Math.max(0, prev - amount));

      // Actual update will happen via edge function
      // This is just for UI responsiveness
      return true;
    } catch (error) {
      // Rollback on error
      setCreditBalance(previousBalance);
      console.error('Error deducting credits:', error);
      return false;
    }
  }, [user?.id, creditBalance]);

  // Initial load
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  // Subscribe to balance changes (realtime)
  useEffect(() => {
    if (!user?.id || !isSignedIn) return;

    const channel = supabase
      .channel(`credit_balance_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && 'credit_balance' in payload.new) {
            setCreditBalance(payload.new.credit_balance || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isSignedIn]);

  return (
    <CreditContext.Provider
      value={{
        creditBalance,
        isLoading,
        refreshBalance,
        deductCredits
      }}
    >
      {children}
    </CreditContext.Provider>
  );
};
