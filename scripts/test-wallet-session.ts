import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
const values = new Map<string, string>();
let failWrites = false;
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failWrites) throw new Error('Storage denied'); values.set(key, value); },
  removeItem: (key: string) => values.delete(key),
};
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });
Object.defineProperty(globalThis, 'document', { value: new EventTarget(), configurable: true });
const { useWalletStore, VAULT_KEY, signSessionEthereum, signSessionBitcoin } = await import('../src/stores/wallet-store');
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const password = 'test-only-password-123';
afterEach(() => { failWrites = false; useWalletStore.getState().removeWallet(); values.clear(); });
test('session: save, lock, reject signing, unlock and revoke stale Cosmos signer', async () => {
  await useWalletStore.getState().saveWithPassword(phrase, password);
  const first = useWalletStore.getState();
  assert.ok(first.signer && first.address && first.btcAddress && first.ethAddress);
  assert.ok(values.has(VAULT_KEY));
  assert.ok(!JSON.stringify([...values]).includes('abandon'));
  const oldSigner = first.signer;
  first.lockWallet();
  assert.equal(useWalletStore.getState().signer, null);
  assert.throws(() => signSessionEthereum({} as never), /locked/);
  assert.throws(() => signSessionBitcoin({} as never), /locked/);
  await assert.rejects(oldSigner.getAccounts(), /locked/);
  await useWalletStore.getState().unlockWithPassword(password);
  assert.equal(useWalletStore.getState().ethAddress, first.ethAddress);
  await assert.rejects(oldSigner.getAccounts(), /locked/);
});
test('session: wrong password and mismatched recovery never replace the vault', async () => {
  await useWalletStore.getState().saveWithPassword(phrase, password);
  const saved = values.get(VAULT_KEY);
  await assert.rejects(useWalletStore.getState().unlockWithPassword('incorrect-password'));
  assert.equal(useWalletStore.getState().signer, null);
  const other = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
  await assert.rejects(useWalletStore.getState().saveWithPassword(other, password), /does not match/);
  assert.equal(values.get(VAULT_KEY), saved);
});
test('session: storage failure cannot publish an unlocked session', async () => {
  failWrites = true;
  await assert.rejects(useWalletStore.getState().saveWithPassword(phrase, password), /Storage denied/);
  assert.equal(useWalletStore.getState().signer, null);
  assert.equal(values.has(VAULT_KEY), false);
});
test('session: lock cancels pending decrypt and pending vault setup', async () => {
  await useWalletStore.getState().saveWithPassword(phrase, password);
  const pending = useWalletStore.getState().unlockWithPassword(password);
  useWalletStore.getState().lockWallet();
  await assert.rejects(pending, /cancelled/);
  const setup = useWalletStore.getState().saveWithPassword(phrase, password);
  useWalletStore.getState().lockWallet();
  await assert.rejects(setup, /cancelled/);
  assert.equal(useWalletStore.getState().signer, null);
});
test('session: another tab vault change locks this tab and removal deletes local vault', async () => {
  await useWalletStore.getState().saveWithPassword(phrase, password);
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: VAULT_KEY });
  window.dispatchEvent(event);
  assert.equal(useWalletStore.getState().signer, null);
  useWalletStore.getState().removeWallet();
  assert.equal(values.has(VAULT_KEY), false);
  assert.equal(useWalletStore.getState().address, null);
});
test('session: recovery resets password without changing derived addresses', async () => {
  await useWalletStore.getState().saveWithPassword(phrase, password);
  const address = useWalletStore.getState().address;
  await useWalletStore.getState().saveWithPassword(phrase, 'replacement-password-456');
  await assert.rejects(useWalletStore.getState().unlockWithPassword(password));
  await useWalletStore.getState().unlockWithPassword('replacement-password-456');
  assert.equal(useWalletStore.getState().address, address);
});
test('session: legacy public addresses migrate without changing the wallet', async () => {
  const { deriveMultichainAddresses } = await import('../src/lib/multichain-wallet');
  const addresses = await deriveMultichainAddresses(phrase);
  values.set('tatcoin.activeAddress', addresses.tat);
  values.set('tatcoin.btcAddress', addresses.btc);
  values.set('tatcoin.ethAddress', addresses.eth);
  await useWalletStore.getState().saveWithPassword(phrase, password);
  assert.equal(useWalletStore.getState().address, addresses.tat);
  assert.equal(useWalletStore.getState().btcAddress, addresses.btc);
  assert.equal(useWalletStore.getState().ethAddress, addresses.eth);
});
test('session: expired session rejects signing even if timer is delayed', async (t) => {
  await useWalletStore.getState().saveWithPassword(phrase, password);
  const future = Date.now() + 16 * 60 * 1000;
  t.mock.method(Date, 'now', () => future);
  assert.throws(() => signSessionEthereum({} as never), /locked/);
  await assert.rejects(useWalletStore.getState().signer!.getAccounts(), /locked/);
});
test('session: unlocked Ethereum signature recovers the expected address offline', async () => {
  const { Transaction } = await import('ethers');
  await useWalletStore.getState().saveWithPassword(phrase, password);
  const address = useWalletStore.getState().ethAddress!;
  const tx = signSessionEthereum({ expectedFromAddress: address, chainId: 1n,
    nonce: 0n, to: address, value: 1n, gasLimit: 21000n,
    maxPriorityFeePerGas: 1n, maxFeePerGas: 2n });
  assert.equal(Transaction.from(tx.rawTxHex).from?.toLowerCase(), address.toLowerCase());
  assert.throws(() => signSessionEthereum({ expectedFromAddress: '0x0000000000000000000000000000000000000001',
    chainId: 1n, nonce: 0n, to: address, value: 1n, gasLimit: 21000n,
    maxPriorityFeePerGas: 1n, maxFeePerGas: 2n }), /does not match/);
});
