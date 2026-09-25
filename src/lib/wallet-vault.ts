/** Versioned, authenticated browser vault. No network access. */
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const AAD = encoder.encode('TatCoin Wallet vault v1');
export interface VaultEnvelope {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function bytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(value.match(/../g)!, (b) => parseInt(b, 16));
}
export function validatePassword(password: string): void {
  if (password.length < 12 || password.length > 256) {
    throw new Error('Use a password between 12 and 256 characters.');
  }
}
export function parseVault(raw: string): VaultEnvelope {
  if (raw.length > 4096) throw new Error('Invalid wallet vault');
  const v = JSON.parse(raw);
  if (!v || v.version !== 1 || v.kdf !== 'PBKDF2-SHA256' ||
      v.iterations !== ITERATIONS || v.cipher !== 'AES-256-GCM' ||
      typeof v.salt !== 'string' || !/^[a-f0-9]{32}$/.test(v.salt) ||
      typeof v.iv !== 'string' || !/^[a-f0-9]{24}$/.test(v.iv) ||
      typeof v.ciphertext !== 'string' ||
      !/^(?:[a-f0-9]{2}){17,1024}$/.test(v.ciphertext)) {
    throw new Error('Unsupported or damaged wallet vault');
  }
  return v;
}
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser cryptography requires HTTPS');
  const passwordBytes = encoder.encode(password);
  try {
    const material = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    );
  } finally { passwordBytes.fill(0); }
}
export async function encryptMnemonic(mnemonic: string, password: string): Promise<string> {
  validatePassword(password);
  const normalized = mnemonic.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > 512) throw new Error('Invalid recovery phrase length');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(normalized);
  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: AAD, tagLength: 128 },
      await key(password, salt), plaintext,
    );
    return JSON.stringify({ version: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
      cipher: 'AES-256-GCM', salt: hex(salt), iv: hex(iv), ciphertext: hex(new Uint8Array(ciphertext)) });
  } finally { plaintext.fill(0); }
}
export async function decryptMnemonic(raw: string, password: string): Promise<string> {
  validatePassword(password);
  const v = parseVault(raw);
  const derivedKey = await key(password, bytes(v.salt));
  let plaintext: Uint8Array | undefined;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(v.iv), additionalData: AAD, tagLength: 128 },
      derivedKey, bytes(v.ciphertext),
    ));
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch { throw new Error('Incorrect password or damaged wallet vault'); }
  finally { plaintext?.fill(0); }
}
