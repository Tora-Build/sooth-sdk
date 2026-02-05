import '../polyfills';
import { useEffect, useRef, useState, createContext, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AppKitProvider,
  AppKit as AppKitView,
  useAccount,
  useAppKitEventSubscription,
  useAppKitLogs,
} from '@reown/appkit-react-native';
// AppKit instance type - use ReturnType since the type export is not directly available
type AppKitInstanceType = ReturnType<typeof import('../src/lib/appkit').createAppKitInstance>;
import { RouterController } from '@reown/appkit-core-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAppKitInstance } from '../src/lib/appkit';
import { theme } from '../src/theme';
import { debugLog } from '../src/lib/debug';
import { DebugBanner } from '../src/components/DebugBanner';

const queryClient = new QueryClient();
const APPKIT_RESET_KEY = 'sooth:walletconnect_reset_v2';
const APPKIT_STORAGE_PREFIX = '@appkit/';

const EventConnectionContext = createContext<{
  eventConnected: boolean;
  setEventConnected: (v: boolean) => void;
}>({ eventConnected: false, setEventConnected: () => {} });

function AuthGate() {
  const { isConnected, address, chainId, chain } = useAccount();
  const { eventConnected } = useContext(EventConnectionContext);
  const segments = useSegments();
  const router = useRouter();
  const prevIsConnected = useRef(isConnected);
  const prevEventConnected = useRef(eventConnected);
  const renderCount = useRef(0);

  const actuallyConnected = isConnected || eventConnected;

  // Log useAccount() return value on every render
  useEffect(() => {
    renderCount.current += 1;
    debugLog('WAGMI', 'useAccount:render', {
      renderCount: renderCount.current,
      isConnected,
      address: address ?? null,
      chainId: chainId ?? null,
      chainName: chain?.name ?? null,
    });
  });

  // Log context state changes
  useEffect(() => {
    if (prevIsConnected.current !== isConnected) {
      debugLog('AUTH', 'isConnected:changed', {
        from: prevIsConnected.current,
        to: isConnected,
        address: address ?? null,
      });
      prevIsConnected.current = isConnected;
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (prevEventConnected.current !== eventConnected) {
      debugLog('AUTH', 'eventConnected:changed', {
        from: prevEventConnected.current,
        to: eventConnected,
      });
      prevEventConnected.current = eventConnected;
    }
  }, [eventConnected]);

  useEffect(() => {
    const inAuthGroup = segments[0] === '(tabs)';

    debugLog('AUTH', 'AuthGate:evaluate', {
      isConnected,
      eventConnected,
      actuallyConnected,
      address: address ?? null,
      segment: segments[0],
      inAuthGroup,
    });

    // Log navigation decision
    if (actuallyConnected && !inAuthGroup) {
      debugLog('AUTH', 'navigation:toTabs', {
        reason: 'actuallyConnected=true, not in (tabs)',
        isConnected,
        eventConnected,
      });
      router.replace('/(tabs)');
    } else if (!actuallyConnected && inAuthGroup) {
      debugLog('AUTH', 'navigation:toLogin', {
        reason: 'actuallyConnected=false, in (tabs)',
        isConnected,
        eventConnected,
      });
      router.replace('/login');
    } else {
      debugLog('AUTH', 'navigation:none', {
        reason: 'no routing needed',
        actuallyConnected,
        inAuthGroup,
      });
    }
  }, [actuallyConnected, segments, isConnected, eventConnected, address, router]);

  return <Slot />;
}

async function resetAppKitStorageOnce() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    if (!keys.length) {
      debugLog('APPKIT', 'reset:skipped', { reason: 'no keys' });
      return;
    }
    if (keys.includes(APPKIT_RESET_KEY)) {
      debugLog('APPKIT', 'reset:skipped', { reason: 'already reset' });
      return;
    }
    const toRemove = keys.filter(
      (key) =>
        key.startsWith('wc@2:') ||
        key.startsWith(APPKIT_STORAGE_PREFIX) ||
        key === 'WALLETCONNECT_DEEPLINK_CHOICE',
    );
    if (toRemove.length) {
      debugLog('APPKIT', 'reset:clearing', { count: toRemove.length, keys: toRemove });
      await AsyncStorage.multiRemove(toRemove);
    }
    await AsyncStorage.setItem(APPKIT_RESET_KEY, '1');
    debugLog('APPKIT', 'reset:complete', {});
  } catch (error) {
    debugLog('APPKIT', 'reset:error', { error: String(error) });
  }
}

function AppKitStatusBanner() {
  const { errorLogs, getRecentLogs } = useAppKitLogs();
  const { setEventConnected } = useContext(EventConnectionContext);
  const lastLoggedIndex = useRef(0);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!errorLogs || errorLogs.length === 0) return;
    const newErrors = errorLogs.slice(lastLoggedIndex.current);
    newErrors.forEach((error) => {
      debugLog('APPKIT', 'errorLog', { error });
    });
    lastLoggedIndex.current = errorLogs.length;
  }, [errorLogs]);

  // Subscribe to ALL AppKit events for comprehensive tracing
  useAppKitEventSubscription('MODAL_OPEN', (event) => {
    debugLog('APPKIT', 'MODAL_OPEN', { data: event.data });
  });

  useAppKitEventSubscription('MODAL_CLOSE', (event) => {
    debugLog('APPKIT', 'MODAL_CLOSE', { data: event.data });
  });

  useAppKitEventSubscription('CONNECT_ERROR', (event) => {
    if (event.data.event !== 'CONNECT_ERROR') return;
    debugLog('APPKIT', 'CONNECT_ERROR', { data: event.data });
    const raw = (event.data as any)?.properties?.message ?? 'Wallet connect failed';
    if (String(raw).toLowerCase().includes('proposal expired')) {
      setBanner('WalletConnect proposal expired. Open the wallet and approve within 5 minutes.');
    } else if (String(raw).toLowerCase().includes('linking_error')) {
      setBanner('Could not open wallet app. Check wallet installation and iOS URL scheme access.');
    } else {
      setBanner(raw);
    }
  });

  useAppKitEventSubscription('SELECT_WALLET', (event) => {
    if (event.data.event !== 'SELECT_WALLET') return;
    const props = (event.data as any)?.properties;
    debugLog('APPKIT', 'SELECT_WALLET', { properties: props });
    const wallet = RouterController.state.data?.wallet as any;
    if (wallet) {
      debugLog('APPKIT', 'wallet:details', {
        id: wallet.id,
        name: wallet.name,
        mobile_link: wallet.mobile_link,
        universal_link: wallet.universal_link,
        app_store: wallet.app_store,
      });
    }
  });

  useAppKitEventSubscription('CONNECT_SUCCESS', (event) => {
    if (event.data.event !== 'CONNECT_SUCCESS') return;
    debugLog('APPKIT', 'CONNECT_SUCCESS', { data: event.data });
    debugLog('AUTH', 'setEventConnected:true', { trigger: 'CONNECT_SUCCESS' });
    setEventConnected(true);
  });

  useAppKitEventSubscription('DISCONNECT_SUCCESS', (event) => {
    if (event.data.event !== 'DISCONNECT_SUCCESS') return;
    debugLog('APPKIT', 'DISCONNECT_SUCCESS', { data: event.data });
    debugLog('AUTH', 'setEventConnected:false', { trigger: 'DISCONNECT_SUCCESS' });
    setEventConnected(false);
  });

  useAppKitEventSubscription('SOCIAL_LOGIN_ERROR', (event) => {
    if (event.data.event !== 'SOCIAL_LOGIN_ERROR') return;
    const provider = (event.data as any)?.properties?.provider ?? 'social';
    debugLog('APPKIT', 'SOCIAL_LOGIN_ERROR', { provider, data: event.data });
    setBanner(`Social login failed (${provider}).`);
    try {
      const recent = getRecentLogs(20);
      debugLog('APPKIT', 'recentLogs:social', { logs: recent });
    } catch {
      // ignore
    }
  });

  // Additional events for comprehensive coverage
  useAppKitEventSubscription('SWITCH_NETWORK', (event) => {
    debugLog('APPKIT', 'SWITCH_NETWORK', { data: event.data });
  });

  if (!banner) return null;

  return (
    <View style={styles.banner} pointerEvents="box-none">
      <View style={styles.bannerCard}>
        <Text style={styles.bannerText}>{banner}</Text>
        <Text style={styles.bannerDismiss} onPress={() => setBanner(null)}>
          Dismiss
        </Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [appKitInstance, setAppKitInstance] = useState<AppKitInstanceType | null>(null);
  const [eventConnected, setEventConnected] = useState(false);

  useEffect(() => {
    debugLog('APPKIT', 'boot', { version: 'v5-debug' });
    let isMounted = true;
    resetAppKitStorageOnce().then(() => {
      if (!isMounted) return;
      debugLog('APPKIT', 'createInstance:start', {});
      setAppKitInstance(createAppKitInstance());
      debugLog('APPKIT', 'createInstance:done', {});
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!appKitInstance) {
    debugLog('APPKIT', 'render:waiting', { reason: 'appKitInstance is null' });
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
    );
  }

  return (
    <AppKitProvider instance={appKitInstance}>
      <QueryClientProvider client={queryClient}>
        <EventConnectionContext.Provider value={{ eventConnected, setEventConnected }}>
          <StatusBar style="light" />
          <AppKitStatusBanner />
          <AuthGate />
          <DebugBanner eventConnected={eventConnected} />
          <View style={{ position: 'absolute', height: '100%', width: '100%', pointerEvents: 'box-none' }}>
            <AppKitView />
          </View>
        </EventConnectionContext.Provider>
      </QueryClientProvider>
    </AppKitProvider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 50,
  },
  bannerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.error,
    padding: theme.spacing.md,
    ...theme.shadows.md,
  },
  bannerText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  bannerDismiss: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
