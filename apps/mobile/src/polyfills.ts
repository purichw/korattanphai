import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
import { getRandomValues, randomUUID } from 'expo-crypto';
globalThis.Buffer = Buffer;
// Excel's pivot IDs and shared libraries need native secure randomness.
if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
}
if (!globalThis.crypto.getRandomValues) Object.defineProperty(globalThis.crypto, 'getRandomValues', { value: getRandomValues });
if (!globalThis.crypto.randomUUID) Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID });
