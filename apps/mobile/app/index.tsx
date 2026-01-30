import { Redirect } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { isReady, user } = usePrivy();

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  if (user) {
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
