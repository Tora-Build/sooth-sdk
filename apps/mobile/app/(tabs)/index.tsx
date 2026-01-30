import { View, Text, StyleSheet, FlatList, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { usePrivy, useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useMarkets } from '../../src/hooks/useMarkets';
import { MarketCard } from '../../src/components/MarketCard';
import { Skeleton } from '../../src/components/Skeleton';
import type { Market } from '../../src/hooks/useMarkets';

export default function MarketsScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const wallet = wallets[0];
  const { data: markets = [], isLoading, error, refetch } = useMarkets();

  const handleTrade = (marketAddress: `0x${string}`) => {
    router.push({
      pathname: '/trade',
      params: { market: marketAddress },
    });
  };

  const renderMarket = ({ item }: { item: Market }) => (
    <View style={styles.cardWrapper}>
      <MarketCard market={item} onTrade={handleTrade} isLoading={false} />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📊</Text>
      <Text style={styles.emptyTitle}>No Markets Yet</Text>
      <Text style={styles.emptySubtitle}>Markets will appear here as they're created</Text>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.skeletonStack}>
        <Skeleton width="100%" height={200} borderRadius={24} />
        <Skeleton width="100%" height={200} borderRadius={24} />
      </View>
      <Text style={styles.loadingText}>Loading markets...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorTitle}>Failed to Load Markets</Text>
      <Text style={styles.errorSubtitle}>{error?.message || 'Unknown error'}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        {wallet && (
          <Text style={styles.wallet}>
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </Text>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        renderLoading()
      ) : error ? (
        renderError()
      ) : markets.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={markets}
          renderItem={renderMarket}
          keyExtractor={(item) => item.address}
          pagingEnabled
          scrollEventThrottle={16}
          snapToInterval={
            Platform.OS === 'web'
              ? undefined
              : Math.round(
                  // Approximate screen height
                  800
                )
          }
          decelerationRate={Platform.OS === 'web' ? 0.98 : 'fast'}
          showsVerticalScrollIndicator={false}
          bounces={true}
          style={styles.flatList}
          contentContainerStyle={styles.flatListContent}
        />
      )}
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  wallet: {
    fontSize: 12,
    color: '#06b6d4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    flexGrow: 1,
  },
  cardWrapper: {
    height: 800,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  skeletonStack: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
});
