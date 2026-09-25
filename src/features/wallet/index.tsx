import { useEffect, useState } from 'react';
import { createWallet } from '../../lib/wallet-core';
import { cancelPendingUnlock, useWalletStore } from '../../stores/wallet-store';

const inputClass = 'mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white';
const buttonClass = 'rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-40';
export default function Wallet() {
  const wallet = useWalletStore();
  const [mode, setMode] = useState<'home' | 'setup' | 'create' | 'recover'>('home');
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState(false);
  useEffect(() => () => cancelPendingUnlock(), []);
  useEffect(() => {
    setPhrase(''); setPassword(''); setConfirmation(''); setBackedUp(false);
  }, [wallet.sessionRevision]);
  function clear() { setPhrase(''); setPassword(''); setConfirmation(''); setBackedUp(false); setError(''); }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Wallet operation failed'); }
    finally { setBusy(false); }
  }
  return <div className="max-w-2xl space-y-6">
    <h1 className="text-2xl font-semibold text-white">Wallet</h1>
    <p className="text-sm text-slate-400">Your password unlocks this browser's encrypted wallet. Keep your recovery phrase: it is required on a new device or if you forget the password or clear browser data.</p>
    {wallet.address && <div className="space-y-3 rounded-2xl border border-white/10 p-5">
      <p className="font-semibold">{wallet.signer ? 'Wallet unlocked' : 'Wallet locked'}</p>
      <p className="break-all text-sm">TAT: {wallet.address}</p>
      <p className="break-all text-sm">BTC: {wallet.btcAddress ?? 'Not available'}</p>
      <p className="break-all text-sm">ETH: {wallet.ethAddress ?? 'Not available'}</p>
      {wallet.signer && <button className={buttonClass} onClick={() => { clear(); setMode('home'); wallet.lockWallet(); }}>Lock wallet</button>}
      <p className="text-xs text-slate-400">The session locks after 15 minutes or when this page closes. Signing still requires your explicit transaction confirmation.</p>
    </div>}
    {mode === 'home' && <div className="space-y-4">
      {wallet.hasVault && !wallet.signer && <form onSubmit={(e) => { e.preventDefault(); void run(async () => {
        const entered = password; setPassword(''); await wallet.unlockWithPassword(entered); clear();
      }); }}>
        <label>Password<input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} maxLength={256} disabled={busy}/></label>
        <button className={`${buttonClass} mt-4`} disabled={busy || !password}>{busy ? 'Unlocking...' : 'Unlock wallet'}</button>
      </form>}
      {!wallet.hasVault && <button disabled={busy} className={buttonClass} onClick={() => { clear(); setMode('setup'); }}>{wallet.address ? 'Set up password with recovery phrase' : 'Restore wallet'}</button>}
      {wallet.hasVault && <button disabled={busy} className="block text-cyan-300" onClick={() => { clear(); setMode('recover'); }}>Recover with phrase / reset password</button>}
      {!wallet.address && !wallet.hasVault && <button disabled={busy} className="block text-cyan-300" onClick={() => void run(async () => {
        const generated = await createWallet(); clear(); setPhrase(generated.mnemonic); setMode('create');
      })}>Create new wallet</button>}
      {(wallet.address || wallet.hasVault) && <button disabled={busy} className="block text-red-300" onClick={() => { clear(); setRemove(true); }}>Remove saved wallet / switch account</button>}
    </div>}
    {mode !== 'home' && <form className="space-y-4 rounded-2xl border border-white/10 p-5" onSubmit={(e) => { e.preventDefault(); void run(async () => {
      if (password !== confirmation) throw new Error('Passwords do not match');
      if (!backedUp) throw new Error('Confirm that your recovery phrase is backed up');
      const entered = phrase; const pass = password;
      setMode('setup'); setPhrase(''); setPassword(''); setConfirmation('');
      await wallet.saveWithPassword(entered, pass); clear(); setMode('home');
    }); }}>
      <h2 className="text-lg font-semibold">{mode === 'create' ? 'Back up your new wallet' : mode === 'recover' ? 'Recover wallet and set a new password' : 'Set up local password'}</h2>
      <label className="block">Recovery phrase<textarea className={inputClass} rows={4} value={phrase} readOnly={mode === 'create'} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" spellCheck={false} disabled={busy}/></label>
      <p className="text-sm text-amber-200">Store your recovery phrase securely. Anyone with it can control the wallet. The password only protects the copy saved in this browser.</p>
      <label className="block">New password<input className={inputClass} type="password" autoComplete="new-password" minLength={12} maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} required/></label>
      <p className="text-xs text-slate-400">Use a unique password of at least 12 characters.</p>
      <label className="block">Confirm password<input className={inputClass} type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} required/></label>
      <label className="flex gap-3"><input type="checkbox" checked={backedUp} onChange={(e) => setBackedUp(e.target.checked)} disabled={busy}/>I have saved my recovery phrase outside this browser.</label>
      <button className={buttonClass} disabled={busy || !phrase.trim() || !backedUp}>{busy ? 'Saving...' : 'Save encrypted wallet and unlock'}</button>
      <button className="ml-4 text-slate-300" type="button" disabled={busy} onClick={() => { clear(); setMode('home'); }}>Cancel</button>
    </form>}
    {remove && <div className="space-y-3 rounded-2xl border border-red-400/30 p-5">
      <p>Remove the encrypted wallet and saved addresses from this browser? Your funds stay on-chain. You will need the recovery phrase to restore access.</p>
      <button className={buttonClass} onClick={() => { try { wallet.removeWallet(); clear(); setRemove(false); setMode('home'); } catch { setError('Could not remove saved wallet. Check browser storage permissions.'); } }}>Confirm removal</button>
      <button className="ml-4" onClick={() => setRemove(false)}>Cancel</button>
    </div>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
