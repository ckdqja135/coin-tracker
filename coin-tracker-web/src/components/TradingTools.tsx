import React, { useState } from 'react';
import { Box, Button, IconButton, Paper, Stack } from '@mui/material';
import { useI18n } from '../i18n';
import { fabSx, panelSx, useFloating } from '../lib/floating';
import { useSelectedCoins } from '../lib/selectedCoins';
import { useSharedTickers } from '../lib/sharedTickers';
import ArbCalc from './ArbCalc';
import KimpAlerts, { useKimpAlertCheck, useKimpAlerts } from './KimpAlerts';
import { CountBadge, Segmented } from './toolsUi';

type Tab = 'calc' | 'alert';

/**
 * 트레이딩 도구: Chat 옆 플로팅 Tools 버튼 → 패널 (차익 계산기 / 김프 알림 탭). 모든 페이지에서 쓸 수 있다.
 * 패널을 닫아도 내용은 그대로 두고(입력값 유지) 숨기기만 한다.
 * 시세는 패널이 열려 있거나 김프 알림이 하나라도 있을 때만 받아 온다 (홈에서는 홈이 받는 시세를 같이 쓴다).
 */
const TradingTools: React.FC = () => {
  const { t } = useI18n();
  const { panel, setPanel, toggle } = useFloating();
  const { coins } = useSelectedCoins();
  const [tab, setTab] = useState<Tab>('calc');
  const alerts = useKimpAlerts();
  const open = panel === 'tools';
  const tickers = useSharedTickers(open || alerts.rules.length > 0);
  useKimpAlertCheck(alerts, tickers);
  const count = alerts.rules.length;

  return (
    <>
      <Paper elevation={0} role="dialog" aria-label={t('tools.title')} sx={{ ...panelSx, display: open ? 'flex' : 'none' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.75, pl: 2.25, pr: 1.75, borderBottom: 1, borderColor: 'divider' }}>
          <Segmented value={tab} onChange={setTab} options={[
            { value: 'calc', label: t('tools.arbitrage') },
            { value: 'alert', label: <>{t('tools.alerts')}<CountBadge n={count} /></> },
          ]} />
          <IconButton size="small" onClick={() => setPanel(null)} aria-label={t('tools.close')} sx={{ fontSize: 20, color: 'text.disabled', borderRadius: '8px' }}>×</IconButton>
        </Stack>
        <Box sx={{ overflowY: 'auto' }}>
          <Box sx={{ display: tab === 'calc' ? 'block' : 'none' }}><ArbCalc coins={coins} tickers={tickers} /></Box>
          <Box sx={{ display: tab === 'alert' ? 'block' : 'none' }}><KimpAlerts coins={coins} tickers={tickers} alerts={alerts} /></Box>
        </Box>
      </Paper>

      <Button onClick={() => toggle('tools')} variant="outlined" aria-expanded={open}
          sx={{
            ...fabSx, bgcolor: open ? 'text.primary' : 'background.paper', color: open ? 'background.paper' : 'text.primary',
            borderColor: open ? 'text.primary' : 'ui.card.border',
            '&:hover': { bgcolor: open ? 'text.primary' : 'ui.pill.hover', borderColor: open ? 'text.primary' : 'ui.card.border' },
          }}>
        {t('tools.title')}<CountBadge n={count} />
      </Button>
    </>
  );
};

export default TradingTools;
