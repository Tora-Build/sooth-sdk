import React, { useState } from 'react';
import { LimitOrderForm } from './LimitOrderForm';
import { Orderbook } from './Orderbook';

interface TradeFormProps {
  marketId: string;
}

export const TradeForm: React.FC<TradeFormProps> = ({ marketId }) => {
  const [selectedOutcome, setSelectedOutcome] = useState<0 | 1>(0);

  return (
    <div className="space-y-4">
      {/* Limit Order Form */}
      <LimitOrderForm marketId={marketId} selectedOutcome={selectedOutcome} onOutcomeChange={setSelectedOutcome} />
      
      {/* Orderbook */}
      <Orderbook marketId={marketId} selectedOutcome={selectedOutcome} />
    </div>
  );
};
