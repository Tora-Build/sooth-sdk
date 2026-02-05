/**
 * Diagnostic logging utility for WalletConnect/AppKit debugging
 * Categories: APPKIT, WAGMI, AUTH, STORAGE, DEEPLINK
 */

type DebugCategory = 'APPKIT' | 'WAGMI' | 'AUTH' | 'STORAGE' | 'DEEPLINK';

interface DebugLogEntry {
  timestamp: string;
  category: DebugCategory;
  event: string;
  data?: Record<string, unknown>;
}

// In-memory log buffer for debug banner display
const logBuffer: DebugLogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

// Subscribers for real-time updates
type LogSubscriber = (entry: DebugLogEntry) => void;
const subscribers: Set<LogSubscriber> = new Set();

/**
 * Structured debug logging for Metro console
 * @param category - Log category for filtering
 * @param event - Event name/description
 * @param data - Optional structured data
 */
export function debugLog(category: DebugCategory, event: string, data?: Record<string, unknown>): void {
  if (!__DEV__) return;

  const timestamp = new Date().toISOString();
  const entry: DebugLogEntry = { timestamp, category, event, data };

  // Format for Metro console
  const prefix = `[${timestamp.split('T')[1].slice(0, 12)}][${category}]`;
  const dataStr = data ? ` ${JSON.stringify(data, truncateValues, 2)}` : '';
  console.log(`${prefix} ${event}${dataStr}`);

  // Store in buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Notify subscribers
  subscribers.forEach((sub) => sub(entry));
}

/**
 * JSON replacer that truncates long values for readability
 */
function truncateValues(key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.length > 100) {
    return value.slice(0, 100) + '...';
  }
  // Mask sensitive values
  if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
    if (typeof value === 'string' && value.length > 4) {
      return value.slice(0, 4) + '****';
    }
  }
  return value;
}

/**
 * Get recent log entries from buffer
 */
export function getRecentLogs(count: number = 20): DebugLogEntry[] {
  return logBuffer.slice(-count);
}

/**
 * Get the most recent log entry
 */
export function getLastLog(): DebugLogEntry | undefined {
  return logBuffer[logBuffer.length - 1];
}

/**
 * Subscribe to new log entries
 */
export function subscribeToLogs(callback: LogSubscriber): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Clear log buffer
 */
export function clearLogs(): void {
  logBuffer.length = 0;
}

export type { DebugCategory, DebugLogEntry };
