import { Outlet } from "react-router-dom";

import TopBar from "../components/layout/TopBar";
import Sidebar from "../components/navigation/Sidebar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200">
      <Sidebar />

      <div className="min-h-screen lg:pl-64">
        <TopBar />

        <main className="mx-auto w-full max-w-7xl p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
