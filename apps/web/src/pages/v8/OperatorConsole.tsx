import React from 'react';
import { useContent } from '../../hooks/useContent';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';

export function OperatorConsole() {
  const { t } = useContent();
  const [tab, setTab] = React.useState('adjudicators');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('operator.title')}</h1>
        <p className="text-slate-400">
          {t('operator.description')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="adjudicators">
            {t('operator.title')}
          </TabsTrigger>
          <TabsTrigger value="guardians">
            {t('operator.guardian')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="adjudicators">
          <div>Adjudicator Console - Coming Soon</div>
        </TabsContent>

        <TabsContent value="guardians">
          <div>Guardian Console - Coming Soon</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OperatorConsole;
