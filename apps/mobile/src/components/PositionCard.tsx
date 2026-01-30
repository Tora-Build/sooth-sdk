import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { formatUnits } from 'viem';
import type { Position } from '../hooks/usePositions';

interface PositionCardProps {
  position: Position;
  onRedeem?: (marketAddress: string, positionType: 'amm' | 'tickbook' | 'lp') => Promise<void>;
  onClaimRefund?: (marketAddress: string) => Promise<void>;
  isLoading?: boolean;
}

export function PositionCard({
  position,
  onRedeem,
  onClaimRefund,
  isLoading = false,
}: PositionCardProps) {
  const [isRedeeming, setIsRedeeming] = React.useState(false);

  const handleRedeem = async () => {
    if (!onRedeem || isRedeeming) return;
    setIsRedeeming(true);
    try {
      await onRedeem(position.marketAddress, position.type);
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleClaimRefund = async () => {
    if (!onClaimRefund || isRedeeming) return;
    setIsRedeeming(true);
    try {
      await onClaimRefund(position.marketAddress);
    } finally {
      setIsRedeeming(false);
    }
  };

  const yesSharesNum = Number(formatUnits(position.yesShares, 18));
  const noSharesNum = Number(formatUnits(position.noShares, 18));
  const lpBalanceNum = position.lpBalance ? Number(formatUnits(position.lpBalance, 18)) : 0;

  const stageColors: Record<string, { bg: string; text: string; border: string }> = {
    bonding: { bg: '#4c1d95', text: '#d8b4fe', border: '#a855f7' },
    live: { bg: '#064e3b', text: '#6ee7b7', border: '#10b981' },
    settled: { bg: '#78350f', text: '#fbbf24', border: '#f59e0b' },
    finalized: { bg: '#064e3b', text: '#6ee7b7', border: '#10b981' },
    dismissed: { bg: '#7f1d1d', text: '#fca5a5', border: '#ef4444' },
  };

  const stageStyle = stageColors[position.stage] || stageColors.bonding;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.marketName}>{position.marketName}</Text>
          <View
            style={[
              styles.stageBadge,
              {
                backgroundColor: stageStyle.bg,
                borderColor: stageStyle.border,
              },
            ]}
          >
            <Text style={[styles.stageBadgeText, { color: stageStyle.text }]}>
              {position.stage.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.value}>${position.valueUsd.toFixed(2)}</Text>
      </View>

      <View style={styles.sharesContainer}>
        {position.type === 'lp' ? (
          <View style={styles.lpShare}>
            <Text style={styles.lpLabel}>LP TOKENS</Text>
            <Text style={styles.lpAmount}>{lpBalanceNum.toFixed(2)}</Text>
          </View>
        ) : (
          <>
            {position.yesShares > 0n && (
              <View style={styles.shareBox}>
                <Text style={styles.shareLabel}>YES</Text>
                <Text style={styles.shareAmount}>{yesSharesNum.toFixed(1)}</Text>
              </View>
            )}
            {position.noShares > 0n && (
              <View style={styles.shareBox}>
                <Text style={styles.shareLabel}>NO</Text>
                <Text style={styles.shareAmount}>{noSharesNum.toFixed(1)}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color="#10b981" style={styles.loader} />
      ) : (
        <>
          {position.stage === 'finalized' && onRedeem && (
            <TouchableOpacity
              style={[styles.button, styles.redeemButton]}
              onPress={handleRedeem}
              disabled={isRedeeming}
            >
              {isRedeeming ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <Text style={styles.redeemButtonText}>
                  {position.type === 'lp' ? 'Redeem LP' : 'Redeem Position'}
                </Text>
              )}
            </TouchableOpacity>
          )}
          {position.stage === 'dismissed' && onClaimRefund && (
            <TouchableOpacity
              style={[styles.button, styles.refundButton]}
              onPress={handleClaimRefund}
              disabled={isRedeeming}
            >
              {isRedeeming ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : (
                <Text style={styles.refundButtonText}>Claim Refund</Text>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  marketName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    fontFamily: 'monospace',
  },
  sharesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  shareBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shareLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  shareAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    fontFamily: 'monospace',
  },
  lpShare: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  lpLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lpAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    fontFamily: 'monospace',
  },
  button: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  redeemButton: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  redeemButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  refundButton: {
    backgroundColor: '#78350f',
    borderColor: '#f59e0b',
  },
  refundButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.5,
  },
  loader: {
    marginVertical: 8,
  },
});
