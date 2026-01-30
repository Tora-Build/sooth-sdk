import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPublicClient } from '../../src/lib/client';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import { TradePanel } from '../../src/components/TradePanel';

type Address = `0x${string}`;

const CHAIN_ID = 84532;

interface MarketContext {
  address: Address;
  question: string;
  yesProbability: number;
  isGraduated: boolean;
}

function useMarketContext(marketAddress: Address | undefined) {
  const deployment = getDeployment(CHAIN_ID);

  return useQuery<MarketContext | null>({
    queryKey: ['market-context', marketAddress, CHAIN_ID],
    queryFn: async () => {
      if (!marketAddress || !deployment) return null;
      const client = getPublicClient();
      const launchpadEngine = deployment.contracts.LaunchpadEngine as Address;
      const ammEngine = deployment.contracts.AMMEngine as Address;

      const [marketData, question, ammState] = await Promise.all([
        client.readContract({
          address: launchpadEngine,
          abi: ABIS.LaunchpadEngine,
          functionName: 'markets',
          args: [marketAddress],
        }) as Promise<readonly unknown[]>,
        client.readContract({
          address: marketAddress,
          abi: ABIS.TruthMarket,
          functionName: 'question',
        }) as Promise<string>,
        client.readContract({
          address: ammEngine,
          abi: ABIS.AMMEngine,
          functionName: 'getMarketState',
          args: [marketAddress],
        }).catch(() => null) as Promise<readonly [bigint, bigint, bigint] | null>,
      ]);

      const isGraduated = marketData[8] as boolean;
      const yesPriceWad = ammState?.[2] ?? 500000000000000000n;
      const yesProbability = Number(yesPriceWad) / 1e18;

      return {
        address: marketAddress,
        question: question || marketAddress.slice(0, 10),
        yesProbability,
        isGraduated,
      };
    },
    enabled: !!marketAddress && !!deployment,
    staleTime: 10_000,
  });
}

export default function TradeScreen() {
  const params = useLocalSearchParams<{ market?: string }>();
  const marketAddress = params.market as Address | undefined;
  const [showTooltip, setShowTooltip] = useState(false);

  const { data: market, isLoading, error } = useMarketContext(marketAddress);

  useEffect(() => {
    const checkTooltip = async () => {
      try {
        const shown = await AsyncStorage.getItem('trade_tooltip_shown');
        if (!shown) {
          setShowTooltip(true);
          await AsyncStorage.setItem('trade_tooltip_shown', 'true');
        }
      } catch (err) {
        console.error('Failed to check tooltip:', err);
      }
    };
    checkTooltip();
  }, []);

  if (!marketAddress) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Trade</Text>
        <Text style={styles.placeholder}>
          Select a market from the Markets tab to start trading.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#818cf8" />
        <Text style={styles.loadingText}>Loading market...</Text>
      </View>
    );
  }

  if (error || !market) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Error</Text>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load market'}
        </Text>
      </View>
    );
  }

  const isSettled = market.isGraduated && (market.yesProbability === 0 || market.yesProbability === 1);

  return (
    <View style={{ flex: 1 }}>
      {isSettled && (
        <View style={styles.settledBanner}>
          <Text style={styles.settledText}>
            🏁 Market settled! View results in Portfolio
          </Text>
        </View>
      )}
      <TradePanel
        marketAddress={market.address}
        question={market.question}
        yesProbability={market.yesProbability}
        isGraduated={market.isGraduated}
      />
      {showTooltip && (
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>
              💡 Enter the number of shares, not USDC amount
            </Text>
            <TouchableOpacity onPress={() => setShowTooltip(false)}>
              <Text style={styles.tooltipDismiss}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  placeholder: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 32,
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 8,
  },
  settledBanner: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  settledText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  tooltipContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  tooltip: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#06b6d4',
    gap: 12,
  },
  tooltipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  tooltipDismiss: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06b6d4',
    textAlign: 'right',
  },
});
