import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useWalletStore } from '../../stores/wallet-store';
export default function WalletSessionBoundary({ children }: { children: ReactNode }) {
  const signer = useWalletStore((state) => state.signer);
  const revision = useWalletStore((state) => state.sessionRevision);
  if (!signer) return <div className="rounded-2xl border border-white/10 p-6">
    <h1 className="text-xl font-semibold">Wallet locked</h1>
    <p className="mt-3 text-slate-400">Unlock your wallet before preparing or signing transactions.</p>
    <Link className="mt-4 inline-block text-cyan-300" to="/wallet">Open wallet</Link>
  </div>;
  return <div key={revision}>{children}</div>;
}
