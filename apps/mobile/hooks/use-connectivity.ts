import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export function useConnectivity() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      if (mounted) setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    };
    check();
    const timer = setInterval(check, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);
  return online;
}
