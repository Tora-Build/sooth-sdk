import { Redirect } from 'expo-router';
import { useAccount } from '@reown/appkit-react-native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { isConnected } = useAccount();

  if (isConnected) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
