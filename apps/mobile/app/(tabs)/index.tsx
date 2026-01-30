import { View, Text, StyleSheet, Platform } from 'react-native';
import { usePrivy, useEmbeddedEthereumWallet } from '@privy-io/expo';

export default function MarketsScreen() {
  const { user } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const wallet = wallets[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Markets</Text>
      {wallet && (
        <Text style={styles.wallet}>
          Wallet: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
        </Text>
      )}
      <Text style={styles.placeholder}>Market listings coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  wallet: {
    fontSize: 12,
    color: '#06b6d4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 24,
  },
  placeholder: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },
});
