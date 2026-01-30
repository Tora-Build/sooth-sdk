import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePrivy } from '@privy-io/expo';

export default function PortfolioScreen() {
  const { logout, user } = usePrivy();

  // Find email from linked accounts
  const emailAccount = user?.linked_accounts?.find(
    (a) => a.type === 'email'
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portfolio</Text>
      {emailAccount && 'address' in emailAccount && (
        <Text style={styles.email}>{emailAccount.address as string}</Text>
      )}
      <Text style={styles.placeholder}>Portfolio tracking coming soon</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
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
  email: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
  },
  placeholder: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },
  logoutButton: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
