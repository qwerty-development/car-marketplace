import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import NoConnectionScreen from '@/components/NoConnectionScreen';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  checkConnection: () => Promise<NetInfo.NetInfoState | null>;
  isConnecting: boolean;
}

export const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
  checkConnection: async () => null,
  isConnecting: false
});

export const useNetwork = () => useContext(NetworkContext);

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
    isConnecting: false
  });

  const checkConnection = async () => {
    try {
      setNetworkState(prev => ({ ...prev, isConnecting: true }));
      const state = await NetInfo.fetch();
      
      // Short delay to ensure UI shows the checking state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setNetworkState({
        isConnected: !!state.isConnected,
        isInternetReachable: state.isInternetReachable === null ? !!state.isConnected : !!state.isInternetReachable,
        isConnecting: false
      });
      
      return state;
    } catch (error) {
      console.error('Error checking network connection:', error);
      setNetworkState(prev => ({ ...prev, isConnecting: false }));
      return null;
    }
  };

  useEffect(() => {
    // Check connection on mount
    checkConnection();

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: !!state.isConnected,
        isInternetReachable: state.isInternetReachable === null ? !!state.isConnected : !!state.isInternetReachable,
        isConnecting: false
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // If there's no connection, show the NoConnectionScreen
  if (!networkState.isConnected || !networkState.isInternetReachable) {
    return <NoConnectionScreen onRetry={checkConnection} />;
  }

  return (
    <NetworkContext.Provider
      value={{
        ...networkState,
        checkConnection,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkProvider;