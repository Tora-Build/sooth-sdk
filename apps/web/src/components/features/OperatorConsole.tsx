import React from 'react';
import { AdjudicatorConsole } from './operator/AdjudicatorConsole';
import { GuardianConsole } from './operator/GuardianConsole';
import { SettlementSimulator } from './operator/SettlementSimulator';

export const OperatorConsole: React.FC = () => {
  return (
    <div className="space-y-12">
      <div className="space-y-12">
        <section>
          <AdjudicatorConsole />
        </section>
        
        <section>
          <GuardianConsole />
        </section>

        <section>
          <SettlementSimulator />
        </section>
      </div>
    </div>
  );
};
