import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAccount } from '@reown/appkit-react-native';
import { theme } from '../theme';
import { subscribeToLogs, getLastLog, type DebugLogEntry } from '../lib/debug';

interface DebugBannerProps {
  eventConnected: boolean;
}

/**
 * Floating debug banner showing real-time connection state
 * Only visible in __DEV__ mode
 */
export function DebugBanner({ eventConnected }: DebugBannerProps) {
  const { isConnected, address, chainId } = useAccount();
  const [lastEvent, setLastEvent] = useState<DebugLogEntry | undefined>(getLastLog);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLogs((entry) => {
      setLastEvent(entry);
    });
    return unsubscribe;
  }, []);

  if (!__DEV__) return null;

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'none';
  const lastEventSummary = lastEvent
    ? `[${lastEvent.category}] ${lastEvent.event}`
    : 'No events';

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={styles.banner}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        {/* Compact view - always shown */}
        <View style={styles.row}>
          <View style={styles.indicator}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isConnected ? theme.colors.success : theme.colors.error },
              ]}
            />
            <Text style={styles.label}>wagmi</Text>
          </View>
          <View style={styles.indicator}>
            <View
              style={[
                styles.dot,
                { backgroundColor: eventConnected ? theme.colors.success : theme.colors.error },
              ]}
            />
            <Text style={styles.label}>event</Text>
          </View>
          <Text style={styles.addressText}>{truncatedAddress}</Text>
        </View>

        {/* Expanded view - additional details */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Chain ID:</Text>
              <Text style={styles.detailValue}>{chainId ?? 'unknown'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>isConnected:</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: isConnected ? theme.colors.success : theme.colors.error },
                ]}
              >
                {String(isConnected)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>eventConnected:</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: eventConnected ? theme.colors.success : theme.colors.error },
                ]}
              >
                {String(eventConnected)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address:</Text>
              <Text style={styles.detailValue}>{address ?? 'none'}</Text>
            </View>
            <View style={[styles.detailRow, { marginTop: 8 }]}>
              <Text style={styles.detailLabel}>Last Event:</Text>
            </View>
            <Text style={styles.eventText}>{lastEventSummary}</Text>
            {lastEvent?.data && (
              <Text style={styles.eventData}>
                {JSON.stringify(lastEvent.data, null, 2).slice(0, 200)}
              </Text>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Above tab bar
    left: 8,
    right: 8,
    zIndex: 999,
  },
  banner: {
    backgroundColor: 'rgba(21, 21, 37, 0.95)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: theme.colors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addressText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  expandedContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    color: theme.colors.textTertiary,
    fontSize: 10,
  },
  detailValue: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: 'monospace',
  },
  eventText: {
    color: theme.colors.accent1,
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  eventData: {
    color: theme.colors.textTertiary,
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});
