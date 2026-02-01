import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAppKit, useAccount, useProvider } from '@reown/appkit-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getDeployment, ABIS } from '@sooth/sdk-core';
import { getWalletClient } from '../../src/lib/client';
import { usePositions } from '../../src/hooks/usePositions';
import { useUSDCBalance } from '../../src/hooks/useUSDCBalance';
import { PositionCard } from '../../src/components/PositionCard';
import type { Address } from 'viem';

const CHAIN_ID = 84532;

export default function PortfolioScreen() {
  const router = useRouter();
  const { disconnect } = useAppKit();
  const { address } = useAccount();
  const { provider } = useProvider();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userAddress = address as Address | undefined;

  const { data: positions = [], isLoading: isLoadingPositions } = usePositions();
  const { balance: usdcBalance = 0n, isLoading: isLoadingBalance } = useUSDCBalance(userAddress);

  const totalPositionValue = positions.reduce((sum, pos) => sum + pos.valueUsd, 0);
  const totalValue = totalPositionValue + Number(usdcBalance) / 1e6;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ['positions'] });
      await queryClient.refetchQueries({ queryKey: ['usdcBalance'] });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const handleRedeem = useCallback(
    async (marketAddress: string, positionType: 'amm' | 'tickbook' | 'lp', lpBalance?: bigint) => {
      if (!userAddress || !provider) {
        Alert.alert('Error', 'Wallet not connected');
        return;
      }

      try {
        const deployment = getDeployment(CHAIN_ID);
        if (!deployment) {
          Alert.alert('Error', 'Deployment not found');
          return;
        }

        const walletClient = getWalletClient(provider, userAddress);
        const market = marketAddress as Address;

        if (positionType === 'amm') {
          // AMM: AMMEngine.settlePosition(market)
          await walletClient.writeContract({
            address: deployment.contracts.AMMEngine as Address,
            abi: ABIS.AMMEngine,
            functionName: 'settlePosition',
            args: [market],
          });
        } else if (positionType === 'tickbook') {
          // TickBook: TickBookVault.redeemResolved(market)
          await walletClient.writeContract({
            address: deployment.contracts.TickBookVault as Address,
            abi: ABIS.TickBookVault,
            functionName: 'redeemResolved',
            args: [market],
          });
        } else if (positionType === 'lp') {
          // LP: LaunchpadEngine.redeemLP(market, lpBalance)
          if (!lpBalance) {
            Alert.alert('Error', 'LP balance required');
            return;
          }
          await walletClient.writeContract({
            address: deployment.contracts.LaunchpadEngine as Address,
            abi: ABIS.LaunchpadEngine,
            functionName: 'redeemLP',
            args: [market, lpBalance],
          });
        }

        Alert.alert('✅ Success', `${positionType.toUpperCase()} position redeemed!`);
        await queryClient.refetchQueries({ queryKey: ['positions'] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('❌ Redeem Failed', message);
        console.error('Redeem failed:', error);
      }
    },
    [userAddress, provider, queryClient]
  );

  const handleClaimRefund = useCallback(
    async (marketAddress: string) => {
      if (!userAddress || !provider) {
        Alert.alert('Error', 'Wallet not connected');
        return;
      }

      try {
        const deployment = getDeployment(CHAIN_ID);
        if (!deployment) {
          Alert.alert('Error', 'Deployment not found');
          return;
        }

        const walletClient = getWalletClient(provider, userAddress);
        const market = marketAddress as Address;

        // LaunchpadEngine.claimRefund(market)
        await walletClient.writeContract({
          address: deployment.contracts.LaunchpadEngine as Address,
          abi: ABIS.LaunchpadEngine,
          functionName: 'claimRefund',
          args: [market],
        });

        Alert.alert('✅ Success', 'Refund claimed successfully!');
        await queryClient.refetchQueries({ queryKey: ['positions'] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('❌ Claim Refund Failed', message);
        console.error('Claim refund failed:', error);
      }
    },
    [userAddress, provider, queryClient]
  );

  const isLoading = isLoadingPositions || isLoadingBalance;

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        scrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          {userAddress && (
            <Text style={styles.email}>
              {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </Text>
          )}
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Value</Text>
          <Text style={styles.balanceAmount}>
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.balanceBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Positions</Text>
              <Text style={styles.breakdownValue}>
                ${totalPositionValue.toFixed(2)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>USDC</Text>
              <Text style={styles.breakdownValue}>
                ${(Number(usdcBalance) / 1e6).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Positions List */}
        <View style={styles.positionsSection}>
          <Text style={styles.sectionTitle}>Positions</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#10b981" />
            </View>
           ) : positions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>🎯</Text>
              <Text style={styles.emptyStateText}>No Positions Yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start trading to see your positions here
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => router.push('/(tabs)')}
              >
                <Text style={styles.emptyStateButtonText}>Go to Markets</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={positions}
              keyExtractor={(item, index) =>
                `${item.marketAddress}-${item.type}-${index}`
              }
              renderItem={({ item }) => (
                <PositionCard
                  position={item}
                  onRedeem={handleRedeem}
                  onClaimRefund={handleClaimRefund}
                  isLoading={isLoading}
                />
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Disconnect Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={() => disconnect()}>
          <Text style={styles.logoutText}>Disconnect Wallet</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  email: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  balanceCard: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f1f5f9',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  balanceBreakdown: {
    flexDirection: 'row',
    gap: 12,
  },
  breakdownItem: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  breakdownLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    fontFamily: 'monospace',
  },
  positionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  logoutButton: {
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
