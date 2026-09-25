import { useWalletStore } from "../stores/wallet-store";
import { Outlet } from "react-router-dom";

import TopBar from "../components/layout/TopBar";
import Sidebar from "../components/navigation/Sidebar";

export default function Layout() {
  const signer = useWalletStore((state) => state.signer);
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200">
      <Sidebar />

      <div className="min-h-screen lg:pl-64">
        <TopBar />

        <main className="mx-auto w-full max-w-7xl p-6 lg:p-8">
          {signer && <div className="mb-4 flex justify-end"><button className="rounded-xl border border-amber-400/30 px-4 py-2 text-amber-200" onClick={() => useWalletStore.getState().lockWallet()}>Lock wallet</button></div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
