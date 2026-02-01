import '../polyfills';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppKitProvider, AppKit, useAccount } from '@reown/appkit-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { appKit } from '../src/lib/appkit';

const queryClient = new QueryClient();

function AuthGate() {
  const { isConnected } = useAccount();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === '(tabs)';

    if (isConnected && !inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isConnected && inAuthGroup) {
      router.replace('/login');
    }
  }, [isConnected, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AppKitProvider instance={appKit}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AuthGate />
        <View style={{ position: 'absolute', height: '100%', width: '100%', pointerEvents: 'box-none' }}>
          <AppKit />
        </View>
      </QueryClientProvider>
    </AppKitProvider>
  );
}
