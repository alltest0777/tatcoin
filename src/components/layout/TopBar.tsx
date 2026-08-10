import { RiNotification3Line } from "react-icons/ri";
import { useWalletStore } from "../../stores/wallet-store";

export default function TopBar() {
  const address = useWalletStore((state) => state.address);
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 px-6 py-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">Welcome back</div>
          <div className="text-lg font-semibold text-white">
            TatCoin Wallet
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <RiNotification3Line className="text-xl" />
          </button>

          <div className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 sm:block">
            <div className="text-xs text-slate-500">Active account</div>
	    <div className="max-w-48 truncate text-sm font-medium text-white">
	       {address ?? "No wallet"}
	    </div>
          </div>
        </div>
      </div>
    </header>
  );
}
