import React, { useEffect, useState } from 'react';
import { getBalance } from '../services/api';

export default function BalanceCard() {
  const [balance, setBalance] = useState('Loading...');

  useEffect(() => {
    const fetchBalance = async () => {
      const result = await getBalance();
      setBalance(result);
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-gray-800 rounded mb-4">
      <h2 className="text-xl">Balance: {balance} TAT</h2>
    </div>
  );
}