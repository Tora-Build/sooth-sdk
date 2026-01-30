import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Skeleton } from './Skeleton';

export interface Market {
  address: `0x${string}`;
  question: string;
  stage: 'bonding' | 'live' | 'settled' | 'finalized' | 'dismissed';
  yesProbability?: number;
  volume?: bigint;
  winningOutcome?: number | null;
}

interface MarketCardProps {
  market: Market;
  onTrade: (marketAddress: `0x${string}`) => void;
  isLoading?: boolean;
}

/**
 * Generate unique gradient colors from market question hash
 */
function hashToHSL(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  const s = 70 + (Math.abs(hash) % 20);
  const l = 50 + (Math.abs(hash >> 8) % 20);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Convert HSL to RGB hex for gradient
 */
function hslToRgb(hslStr: string): string {
  const match = hslStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#6366f1';

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get stage badge color and label
 */
function getStageBadge(stage: string): { label: string; bgColor: string; textColor: string } {
  switch (stage) {
    case 'bonding':
      return { label: '🌱 Bonding', bgColor: '#10b981', textColor: '#ffffff' };
    case 'live':
      return { label: '🔥 Live', bgColor: '#f59e0b', textColor: '#ffffff' };
    case 'settled':
      return { label: '✓ Settled', bgColor: '#8b5cf6', textColor: '#ffffff' };
    case 'finalized':
      return { label: '🏁 Finalized', bgColor: '#6366f1', textColor: '#ffffff' };
    case 'dismissed':
      return { label: '❌ Dismissed', bgColor: '#ef4444', textColor: '#ffffff' };
    default:
      return { label: stage, bgColor: '#64748b', textColor: '#ffffff' };
  }
}

/**
 * Get outcome label from winning outcome code
 */
function getOutcomeLabel(outcome: number | null | undefined): string {
  if (outcome === null || outcome === undefined) return '';
  if (outcome === 1) return '✓ YES Won';
  if (outcome === 0) return '✗ NO Won';
  if (outcome === 2) return '⚖️ INVALID';
  return '';
}

export const MarketCard: React.FC<MarketCardProps> = ({ market, onTrade, isLoading = false }) => {
  if (isLoading) {
    return (
      <View style={styles.cardContainer}>
        <View style={styles.skeletonGradient}>
          <View style={styles.skeletonContent}>
            <Skeleton width={80} height={24} borderRadius={12} />
            <Skeleton width="100%" height={100} borderRadius={8} />
            <Skeleton width={120} height={48} borderRadius={8} />
            <Skeleton width="100%" height={44} borderRadius={12} />
          </View>
        </View>
      </View>
    );
  }

  const color1 = hashToHSL(market.question);
  const color2 = hashToHSL(market.question + 'offset');
  const gradientStart = hslToRgb(color1);
  const gradientEnd = hslToRgb(color2);

  const stageBadge = getStageBadge(market.stage);
  const isSettled = market.stage === 'settled' || market.stage === 'finalized';
  const yesPct = market.yesProbability ? Math.round(market.yesProbability * 100) : 50;

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Dark overlay for text readability */}
        <View style={styles.overlay} />

        {/* Content */}
        <View style={styles.content}>
          {/* Stage Badge */}
          <View
            style={[
              styles.stageBadge,
              { backgroundColor: stageBadge.bgColor },
            ]}
          >
            <Text style={[styles.stageBadgeText, { color: stageBadge.textColor }]}>
              {stageBadge.label}
            </Text>
          </View>

          {/* Question */}
          <Text style={styles.question} numberOfLines={4}>
            {market.question}
          </Text>

          {/* Price or Outcome */}
          {isSettled ? (
            <View style={styles.outcomeSection}>
              <Text style={styles.outcomeLabel}>{getOutcomeLabel(market.winningOutcome)}</Text>
            </View>
          ) : (
            <View style={styles.priceSection}>
              <Text style={styles.priceLabel}>YES Price</Text>
              <Text style={styles.priceValue}>{yesPct}%</Text>
            </View>
          )}

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaButton, isSettled && styles.ctaButtonSettled]}
            onPress={() => onTrade(market.address)}
          >
            <Text style={styles.ctaButtonText}>
              {isSettled ? 'View Results' : 'Trade'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  skeletonGradient: {
    width: '100%',
    height: '90%',
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: '#1e293b',
  },
  skeletonContent: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16,
  },
  gradient: {
    width: '100%',
    height: '90%',
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  stageBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  stageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  question: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 32,
    lineHeight: 40,
  },
  priceSection: {
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
  },
  outcomeSection: {
    marginBottom: 24,
  },
  outcomeLabel: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  ctaButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonSettled: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
});
