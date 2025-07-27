import React, { useState } from 'react';
import { sendTx } from '../services/api';

export default function SendTransaction({ setLoading }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await sendTx(recipient, amount);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 p-4 rounded">
      <input
        type="text"
        placeholder="Recipient"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        className="mb-2 p-2 w-full text-black"
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-2 p-2 w-full text-black"
      />
      <button type="submit" className="bg-blue-500 px-4 py-2 rounded">
        Send
      </button>
    </form>
  );
}