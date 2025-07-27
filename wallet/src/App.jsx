import React, { useState } from 'react';
import BalanceCard from './components/BalanceCard';
import SendTransaction from './components/SendTransaction';
import OilPumpLoader from './components/OilPumpLoader';

export default function App() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-6">
      {loading && <OilPumpLoader />}
      <h1 className="text-3xl font-bold mb-4">TatCoin Wallet</h1>
      <BalanceCard />
      <SendTransaction setLoading={setLoading} />
    </div>
  );
}