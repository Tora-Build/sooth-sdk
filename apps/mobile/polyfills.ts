console.log('[POLYFILL] Starting polyfill setup...');

import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

console.log('[POLYFILL] Importing react-native-quick-crypto...');
const QuickCrypto = require('react-native-quick-crypto');

console.log('[POLYFILL] QuickCrypto:', typeof QuickCrypto, Object.keys(QuickCrypto).slice(0, 10));

console.log('[POLYFILL] Calling install()...');
QuickCrypto.install();

console.log('[POLYFILL] After install, global.crypto:', typeof global.crypto);

if (!global.crypto) {
  console.log('[POLYFILL] global.crypto is undefined, setting manually...');
  global.crypto = QuickCrypto;
  console.log('[POLYFILL] After manual set, global.crypto:', typeof global.crypto);
}

if (!global.crypto) {
  throw new Error('[POLYFILL] Failed to polyfill global.crypto');
}

console.log('[POLYFILL] Polyfill setup complete. global.crypto.subtle:', typeof global.crypto.subtle);
