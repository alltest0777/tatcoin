import {
  RiDashboardLine,
  RiExchangeFundsLine,
  RiHistoryLine,
  RiSettings3Line,
  RiShieldCheckLine,
  RiWallet3Line,
} from "react-icons/ri";
import { NavLink } from "react-router-dom";

const navigation = [
  { to: "/", label: "Dashboard", icon: RiDashboardLine, end: true },
  { to: "/wallet", label: "Wallet", icon: RiWallet3Line },
  { to: "/send", label: "Send", icon: RiExchangeFundsLine },
  { to: "/receive", label: "Receive", icon: RiHistoryLine },
  { to: "/staking", label: "Staking", icon: RiShieldCheckLine },
  { to: "/explorer", label: "Explorer", icon: RiHistoryLine },
  { to: "/settings", label: "Settings", icon: RiSettings3Line },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-slate-950/95 px-4 py-6 lg:block">
      <div className="mb-10 flex items-center gap-3 px-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 font-bold text-slate-950">
          T
        </div>

        <div>
          <div className="text-lg font-semibold text-white">TatCoin</div>
          <div className="text-xs text-slate-500">Wallet 2.0</div>
        </div>
      </div>

      <nav className="space-y-2">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-cyan-400/15 text-cyan-300"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
              ].join(" ")
            }
          >
            <Icon className="text-xl" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="absolute bottom-6 left-4 right-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
          Network
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          TatCoin Mainnet
        </div>
        <div className="mt-1 text-xs text-slate-500">Chain ID: tat-1</div>
      </div>
    </aside>
  );
}
