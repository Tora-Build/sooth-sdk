import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppKit, useAccount } from '@reown/appkit-react-native';

export default function LoginScreen() {
  const { open } = useAppKit();
  const { isConnected } = useAccount();

  if (isConnected) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sooth Protocol</Text>
      <Text style={styles.subtitle}>Prediction Markets</Text>

      <View style={styles.form}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => open({ view: 'Connect' })}
        >
          <Text style={styles.buttonText}>Connect Wallet</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          MetaMask, Rainbow, Trust Wallet & more
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 48,
  },
  form: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#06b6d4',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
