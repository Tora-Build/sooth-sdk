import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { getDeployment, ABIS, computeMarketKey } from '@sooth/sdk-core';
import { useAMMQuote } from '../hooks/useAMMQuote';
import {
  useUSDCBalance,
  checkAllowance,
  approveUSDC,
  mintTestnetUSDC,
} from '../hooks/useUSDCBalance';
import { getPublicClient, getWalletClient } from '../lib/client';

type Address = `0x${string}`;

const CHAIN_ID = 84532;
const SHARE_PRESETS = [1, 5, 10, 25];

interface TradePanelProps {
  marketAddress: Address;
  question: string;
  yesProbability: number;
  isGraduated: boolean;
}

export const TradePanel: React.FC<TradePanelProps> = ({
  marketAddress,
  question,
  yesProbability,
  isGraduated,
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(1);
  const [sharesInput, setSharesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { wallets } = useEmbeddedEthereumWallet();
  const wallet = wallets?.[0];
  const userAddress = wallet?.address as Address | undefined;

  const { balance, balanceFormatted, refetch: refetchBalance } = useUSDCBalance(userAddress);
  const quote = useAMMQuote(marketAddress, sharesInput, selectedOutcome, yesProbability);

  const deployment = getDeployment(CHAIN_ID);
  const hasZeroBalance = balance === 0n && !!userAddress;
  const yesPct = Math.round(yesProbability * 100);
  const noPct = 100 - yesPct;

  const handlePreset = useCallback((amount: number) => {
    setSharesInput(amount.toString());
  }, []);

  const handleMintUSDC = useCallback(async () => {
    if (!wallet || !userAddress) {
      Alert.alert('Error', 'Connect wallet first');
      return;
    }
    setIsSubmitting(true);
    try {
      await mintTestnetUSDC(wallet, userAddress);
      refetchBalance();
      Alert.alert('Success', 'Minted 1,000 testnet USDC!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Mint failed';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [wallet, userAddress, refetchBalance]);

  const executeAMMTrade = useCallback(async () => {
    if (!wallet || !userAddress || !deployment) return;

    const launchpadEngine = deployment.contracts.LaunchpadEngine as Address;
    const walletClient = await getWalletClient(wallet);

    const allowance = await checkAllowance(userAddress, launchpadEngine);
    if (allowance < quote.limitCost) {
      await approveUSDC(wallet, launchpadEngine);
    }

    await walletClient.writeContract({
      address: launchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'tradePositions',
      args: [marketAddress, selectedOutcome, quote.deltaShares, quote.limitCost],
    });
  }, [wallet, userAddress, deployment, marketAddress, selectedOutcome, quote]);

  const executeTickBookOrder = useCallback(async () => {
    if (!wallet || !userAddress || !deployment) return;

    const client = getPublicClient();
    const walletClient = await getWalletClient(wallet);
    const collateralizer = deployment.contracts.Collateralizer as Address;
    const tickBookVault = deployment.contracts.TickBookVault as Address;
    const tickBookPoolManager = deployment.contracts.TickBookPoolManager as Address;

    const tokens = await client.readContract({
      address: collateralizer,
      abi: ABIS.Collateralizer,
      functionName: 'getOutcomeTokens',
      args: [marketAddress],
    }) as readonly [Address, Address];

    const [yesToken, noToken] = tokens;
    const marketKey = computeMarketKey(marketAddress, yesToken, noToken);

    const allowance = await checkAllowance(userAddress, tickBookVault);
    // maxCost = shares * 1.2 (20% buffer for multi-tick sweep)
    const maxCost = (quote.deltaShares * 120n) / 100n;

    if (allowance < maxCost) {
      await approveUSDC(wallet, tickBookVault);
    }

    const availableBalance = await client.readContract({
      address: tickBookVault,
      abi: ABIS.TickBookVault,
      functionName: 'availableUsdcWad',
      args: [userAddress],
    }) as bigint;

    if (availableBalance < maxCost) {
      const depositAmount = maxCost - availableBalance;
      await walletClient.writeContract({
        address: tickBookVault,
        abi: ABIS.TickBookVault,
        functionName: 'depositUsdc',
        args: [depositAmount],
      });
    }

    await walletClient.writeContract({
      address: tickBookPoolManager,
      abi: ABIS.TickBookPoolManager,
      functionName: 'placeOrder',
      args: [marketKey, selectedOutcome, quote.deltaShares, 1, 999, maxCost],
    });
  }, [wallet, userAddress, deployment, marketAddress, selectedOutcome, quote]);

  const handleTrade = useCallback(async () => {
    if (!wallet || !userAddress || !deployment) {
      Alert.alert('Error', 'Connect wallet first');
      return;
    }
    if (quote.deltaShares <= 0n) {
      Alert.alert('Error', 'Enter shares amount');
      return;
    }
    if (!isGraduated && balance < quote.limitCost) {
      Alert.alert('Insufficient Balance', 'You need more USDC. Tap "Get testnet USDC" below.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isGraduated) {
        await executeTickBookOrder();
      } else {
        await executeAMMTrade();
      }
      refetchBalance();
      setSharesInput('');
      Alert.alert('Success', `Bought ${sharesInput} ${selectedOutcome === 1 ? 'YES' : 'NO'} shares!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Trade failed';
      Alert.alert('Trade Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    wallet, userAddress, deployment, quote, balance, isGraduated,
    sharesInput, selectedOutcome, executeAMMTrade, executeTickBookOrder, refetchBalance,
  ]);

  const outcomeLabel = selectedOutcome === 1 ? 'YES' : 'NO';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.question} numberOfLines={3}>{question}</Text>

      {/* Current Prices */}
      <View style={styles.priceRow}>
        <View style={[styles.priceBox, { backgroundColor: '#065f46' }]}>
          <Text style={styles.priceLabel}>YES</Text>
          <Text style={styles.priceValue}>{yesPct}¢</Text>
        </View>
        <View style={[styles.priceBox, { backgroundColor: '#7f1d1d' }]}>
          <Text style={styles.priceLabel}>NO</Text>
          <Text style={styles.priceValue}>{noPct}¢</Text>
        </View>
      </View>

      {/* USDC Balance */}
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>{balanceFormatted} USDC</Text>
      </View>

      {hasZeroBalance && (
        <TouchableOpacity
          style={styles.mintButton}
          onPress={handleMintUSDC}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.mintButtonText}>Get testnet USDC</Text>
          )}
        </TouchableOpacity>
      )}

      {/* YES/NO Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            selectedOutcome === 1 && styles.toggleYesActive,
          ]}
          onPress={() => setSelectedOutcome(1)}
        >
          <Text style={[
            styles.toggleText,
            selectedOutcome === 1 && styles.toggleTextActive,
          ]}>YES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            selectedOutcome === 0 && styles.toggleNoActive,
          ]}
          onPress={() => setSelectedOutcome(0)}
        >
          <Text style={[
            styles.toggleText,
            selectedOutcome === 0 && styles.toggleTextActive,
          ]}>NO</Text>
        </TouchableOpacity>
      </View>

      {/* Shares Input */}
      <Text style={styles.inputLabel}>Shares to Buy</Text>
      <TextInput
        style={styles.input}
        value={sharesInput}
        onChangeText={setSharesInput}
        placeholder="0"
        placeholderTextColor="#64748b"
        keyboardType="numeric"
      />

      {/* Preset Buttons */}
      <View style={styles.presetRow}>
        {SHARE_PRESETS.map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.presetButton}
            onPress={() => handlePreset(amount)}
          >
            <Text style={styles.presetText}>{amount}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quote Details */}
      {quote.deltaShares > 0n && (
        <View style={styles.quoteSection}>
          {quote.isLoading ? (
            <ActivityIndicator color="#818cf8" />
          ) : quote.error ? (
            <Text style={styles.errorText}>{quote.error.message}</Text>
          ) : (
            <>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Estimated Cost</Text>
                <Text style={styles.quoteValue}>{quote.costFormatted} USDC</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Fee ({(quote.feeRateBps / 100).toFixed(1)}%)</Text>
                <Text style={styles.quoteValue}>{quote.feeFormatted} USDC</Text>
              </View>
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>Price Impact</Text>
                <Text style={[
                  styles.quoteValue,
                  Math.abs(quote.priceImpact) > 5 && styles.highImpact,
                ]}>
                  {quote.priceImpact > 0 ? '+' : ''}{quote.priceImpact.toFixed(2)}%
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Buy Button */}
      <TouchableOpacity
        style={[
          styles.buyButton,
          selectedOutcome === 1 ? styles.buyButtonYes : styles.buyButtonNo,
          (isSubmitting || quote.deltaShares <= 0n) && styles.buyButtonDisabled,
        ]}
        onPress={handleTrade}
        disabled={isSubmitting || quote.deltaShares <= 0n}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buyButtonText}>
            Buy {outcomeLabel} Shares
          </Text>
        )}
      </TouchableOpacity>

      {isGraduated && (
        <Text style={styles.graduatedNote}>
          This market is graduated — orders go through the TickBook orderbook.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 16,
    lineHeight: 28,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  priceBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  mintButton: {
    backgroundColor: '#fbbf24',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  mintButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleYesActive: {
    backgroundColor: '#10b981',
  },
  toggleNoActive: {
    backgroundColor: '#ef4444',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '600',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#818cf8',
  },
  quoteSection: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  quoteValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  highImpact: {
    color: '#f59e0b',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  buyButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buyButtonYes: {
    backgroundColor: '#10b981',
  },
  buyButtonNo: {
    backgroundColor: '#ef4444',
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  buyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  graduatedNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
});
