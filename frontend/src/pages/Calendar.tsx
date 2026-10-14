import React from 'react';
import { PageHeader, Panel } from '../components/Panel';
import TradingViewWidget from '../components/TradingViewWidget';
import { useI18n } from '../i18n';

const Calendar: React.FC = () => {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('calendar.title')} desc={t('calendar.desc')} />
      <Panel>
        <TradingViewWidget widget="events" height={720} config={{ importanceFilter: '0,1', countryFilter: 'us,kr,cn,jp,eu' }} />
      </Panel>
    </>
  );
};

export default Calendar;
