import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
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

  const { data: market, isLoading, error } = useMarketContext(marketAddress);

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

  return (
    <TradePanel
      marketAddress={market.address}
      question={market.question}
      yesProbability={market.yesProbability}
      isGraduated={market.isGraduated}
    />
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
});
