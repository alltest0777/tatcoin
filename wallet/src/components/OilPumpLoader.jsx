import React from 'react';

export default function OilPumpLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="30" stroke="#fff" fill="none" strokeWidth="5">
          <animate attributeName="stroke-dasharray" values="3;50;2;3" dur="1s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}