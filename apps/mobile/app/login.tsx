import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLoginWithEmail, usePrivy } from '@privy-io/expo';
import { useState } from 'react';

export default function LoginScreen() {
  const { isReady } = usePrivy();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>Sooth Protocol</Text>
      <Text style={styles.subtitle}>Prediction Markets</Text>

      {state.status === 'initial' || state.status === 'error' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, !email && styles.buttonDisabled]}
            onPress={() => email && sendCode({ email })}
            disabled={!email}
          >
            <Text style={styles.buttonText}>Continue with Email</Text>
          </TouchableOpacity>
          {state.status === 'error' && (
            <Text style={styles.error}>Something went wrong. Try again.</Text>
          )}
        </View>
      ) : state.status === 'awaiting-code-input' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Enter verification code</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            placeholderTextColor="#64748b"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoFocus
          />
          <TouchableOpacity
            style={[styles.button, !code && styles.buttonDisabled]}
            onPress={() => code && loginWithCode({ code })}
            disabled={!code}
          >
            <Text style={styles.buttonText}>Verify</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ActivityIndicator size="large" color="#06b6d4" />
      )}
    </KeyboardAvoidingView>
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
  },
  label: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#06b6d4',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
});
