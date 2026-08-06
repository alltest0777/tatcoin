import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#fff",
        padding: 24,
      }}
    >
      <h1>TatCoin Wallet 2.0</h1>

      <hr />

      <Outlet />
    </div>
  );
}
