import WalletSessionBoundary from "../components/layout/WalletSessionBoundary";
import { createBrowserRouter } from "react-router-dom";

import Layout from "./layout";

import Dashboard from "../features/dashboard";
import Wallet from "../features/wallet";
import Send from "../features/send";
import Swap from "../features/swap";
import Receive from "../features/receive";
import Staking from "../features/staking";
import Explorer from "../features/explorer";
import Settings from "../features/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "wallet",
        element: <Wallet />,
      },
      {
        path: "send",
        element: <WalletSessionBoundary><Send /></WalletSessionBoundary>,
      },
      {
        path: "swap",
        element: <WalletSessionBoundary><Swap /></WalletSessionBoundary>,
      },
      {
        path: "receive",
        element: <Receive />,
      },
      {
        path: "staking",
        element: <WalletSessionBoundary><Staking /></WalletSessionBoundary>,
      },
      {
        path: "explorer",
        element: <Explorer />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
]);
