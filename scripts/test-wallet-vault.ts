import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptMnemonic, decryptMnemonic, parseVault } from '../src/lib/wallet-vault';
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const password = 'test-only-password-123';
test('vault: round trip, randomized salt and IV, no plaintext', async () => {
  const a = await encryptMnemonic(phrase, password);
  const b = await encryptMnemonic(phrase, password);
  assert.notEqual(a, b);
  assert.notEqual(parseVault(a).salt, parseVault(b).salt);
  assert.notEqual(parseVault(a).iv, parseVault(b).iv);
  assert.ok(!a.includes('abandon'));
  assert.ok(!a.includes(password));
  assert.equal(await decryptMnemonic(a, password), phrase);
});
test('vault: incorrect password and tampered ciphertext are rejected', async () => {
  const raw = await encryptMnemonic(phrase, password);
  await assert.rejects(decryptMnemonic(raw, 'wrong-password-123'));
  const damaged = JSON.parse(raw);
  damaged.ciphertext = (damaged.ciphertext.startsWith('00') ? 'ff' : '00') + damaged.ciphertext.slice(2);
  await assert.rejects(decryptMnemonic(JSON.stringify(damaged), password));
});
test('vault: unsupported version, excessive KDF, oversized data and weak password are rejected', async () => {
  const v = JSON.parse(await encryptMnemonic(phrase, password));
  for (const change of [{ version: 2 }, { iterations: 9_000_000_000 }, { iv: '00' }, { salt: [] }]) {
    assert.throws(() => parseVault(JSON.stringify({ ...v, ...change })));
  }
  assert.throws(() => parseVault('x'.repeat(4097)));
  await assert.rejects(encryptMnemonic(phrase, 'short'));
});
