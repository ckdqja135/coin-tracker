import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, ButtonGroup, Chip, LinearProgress, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import Highcharts from 'highcharts/highstock';
import StockChart, { baseOptions, yAxis } from '../components/StockChart';
import { ChartState, PageHeader, Panel } from '../components/Panel';
import { useI18n } from '../i18n';
import { fmtCompact, fmtPrice } from '../lib/chartUtils';
import { useAsync } from '../lib/useAsync';
import { LongShortExchange, fetchLongShort } from '../services/market';

const COINS = ['BTC', 'ETH'] as const;
const EXCHANGES: { id: LongShortExchange; label: string }[] = [
  { id: 'binance', label: 'Binance' },
  { id: 'bybit', label: 'Bybit' },
  { id: 'okx', label: 'OKX' },
];
// 서버의 거래소별 지원 period와 동일하게 유지
const PERIODS: Record<LongShortExchange, string[]> = {
  binance: ['5m', '15m', '30m', '1h', '2h', '4h', '12h', '1d'],
  bybit: ['5m', '15m', '30m', '1h', '4h', '1d'],
  okx: ['5m', '1h', '1d'],
};

const LONG = '#26a69a';
const SHORT = '#ef5350';

const RatioBar: React.FC<{ label: string; long?: number; short?: number }> = ({ label, long, short }) => (
  <Box sx={{ mb: 1.5 }}>
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: LONG }}>{long != null ? (long * 100).toFixed(1) : '-'}%</span>
        {' / '}
        <span style={{ color: SHORT }}>{short != null ? (short * 100).toFixed(1) : '-'}%</span>
        {long != null && short ? ` · ${(long / short).toFixed(2)}` : ''}
      </Typography>
    </Stack>
    <LinearProgress variant="determinate" value={(long ?? 0.5) * 100}
      sx={{ height: 8, borderRadius: 4, bgcolor: SHORT, '& .MuiLinearProgress-bar': { bgcolor: LONG } }} />
  </Box>
);

// ---------------------------------------------------------------------------
// 실시간 대규모 체결 / 청산 (바이낸스 선물 웹소켓)
// ---------------------------------------------------------------------------
interface TradeRow {
  id: string;
  kind: 'trade' | 'liquidation';
  side: 'buy' | 'sell';
  price: number;
  qty: number;
  usd: number;
  time: number;
}

const THRESHOLDS = [
  { key: 'ls.filter.base', min: 100_000 },
  { key: 'ls.filter.significant', min: 1_000_000 },
  { key: 'ls.filter.huge', min: 10_000_000 },
] as const;

const MAX_ROWS = 60;

const useWhaleFeed = (coin: string) => {
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setRows([]);
    const sym = `${coin.toLowerCase()}usdt`;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`wss://fstream.binance.com/market/stream?streams=${sym}@aggTrade/${sym}@forceOrder`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onmessage = ev => {
        const { data } = JSON.parse(ev.data);
        let row: TradeRow | null = null;
        if (data.e === 'aggTrade') {
          const price = +data.p;
          const qty = +data.q;
          const usd = price * qty;
          if (usd < THRESHOLDS[0].min) return;
          // m=true: 매수자가 메이커 -> 테이커 매도
          row = { id: `t${data.a}`, kind: 'trade', side: data.m ? 'sell' : 'buy', price, qty, usd, time: data.T };
        } else if (data.e === 'forceOrder') {
          const o = data.o;
          const price = +o.ap || +o.p;
          const qty = +o.z || +o.q;
          // SELL 청산 주문 = 롱 포지션 청산
          row = { id: `l${o.T}${o.S}${qty}`, kind: 'liquidation', side: o.S === 'BUY' ? 'buy' : 'sell', price, qty, usd: price * qty, time: o.T };
        }
        if (row) {
          const r = row;
          setRows(prev => [r, ...prev].slice(0, MAX_ROWS * 4));
        }
      };
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [coin]);

  return { rows, connected };
};

const useNow = (ms: number) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
};

const age = (now: number, t: number) => {
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
};

const WhaleFeed: React.FC<{ coin: string }> = ({ coin }) => {
  const { t } = useI18n();
  const { rows, connected } = useWhaleFeed(coin);
  const [minUsd, setMinUsd] = useState<number>(THRESHOLDS[0].min);
  const [kinds, setKinds] = useState<string[]>(['trade', 'liquidation']);
  const now = useNow(1000);
  const visible = rows.filter(r => r.usd >= minUsd && kinds.includes(r.kind)).slice(0, MAX_ROWS);
  // 체결: buy = 롱 진입 성격, 청산: SELL 주문 = 롱 청산
  const isLongColor = (r: TradeRow) => (r.kind === 'trade' ? r.side === 'buy' : r.side === 'buy');

  return (
    <Panel
      title={t('ls.whales')}
      actions={<Chip size="small" label={connected ? `● ${t('ls.connected')}` : t('ls.disconnected')} color={connected ? 'success' : 'default'} variant="outlined" />}
    >
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
        <ButtonGroup size="small" color="inherit">
          {THRESHOLDS.map(th => (
            <Button key={th.key} variant={minUsd === th.min ? 'contained' : 'outlined'} color={minUsd === th.min ? 'primary' : 'inherit'}
              onClick={() => setMinUsd(th.min)} sx={{ fontSize: 12 }}>{t(th.key)}</Button>
          ))}
        </ButtonGroup>
        <ToggleButtonGroup size="small" value={kinds} onChange={(_, v) => v.length && setKinds(v)}>
          <ToggleButton value="trade" sx={{ fontSize: 12, py: 0.3 }}>{t('ls.showTrades')}</ToggleButton>
          <ToggleButton value="liquidation" sx={{ fontSize: 12, py: 0.3 }}>{t('ls.showLiq')}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Box sx={{ maxHeight: 520, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{t('ls.col.side')}</TableCell>
              <TableCell align="right">{t('ls.col.price')}</TableCell>
              <TableCell align="right">{t('ls.col.size')}</TableCell>
              <TableCell align="right">{t('ls.col.qty')}</TableCell>
              <TableCell align="right">{t('ls.col.age')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 4 }}>{t('ls.waiting')}</TableCell></TableRow>
            )}
            {visible.map(r => {
              const color = isLongColor(r) ? LONG : SHORT;
              const label = r.kind === 'trade'
                ? (r.side === 'buy' ? t('common.long') : t('common.short'))
                : `${r.side === 'sell' ? t('common.long') : t('common.short')} ${t('ls.liquidation')}`;
              return (
                <TableRow key={r.id} sx={{ bgcolor: r.usd >= 1_000_000 ? `${color}22` : undefined }}>
                  <TableCell sx={{ color, fontWeight: 700 }}>{r.kind === 'liquidation' ? '💥 ' : ''}{label}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPrice(r.price)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>${fmtCompact(r.usd)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.qty.toLocaleString('en-US', { maximumFractionDigits: 3 })}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>{age(now, r.time)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------
const LongShort: React.FC = () => {
  const { t } = useI18n();
  const [coin, setCoin] = useState<string>('BTC');
  const [exchange, setExchange] = useState<LongShortExchange>('binance');
  const [period, setPeriod] = useState('1h');
  const p = PERIODS[exchange].includes(period) ? period : '1h';

  const history = useAsync(() => fetchLongShort(exchange, coin, p, 100), [exchange, coin, p], 60_000);
  const current = useAsync(
    () => Promise.all(EXCHANGES.map(e => fetchLongShort(e.id, coin, '5m', 1).then(r => r.data[r.data.length - 1]).catch(() => undefined))),
    [coin], 60_000,
  );

  const chartRef = useRef(null);
  const options = useMemo<Highcharts.Options>(() => {
    const base = baseOptions();
    const data = history.data?.data ?? [];
    return {
      ...base,
      chart: { ...base.chart, height: 420 },
      navigator: { enabled: false },
      yAxis: [
        yAxis({ max: 100, min: 0, labels: { format: '{value}%', align: 'left', x: 6, style: { color: '#9aa4b2' } }, height: '100%' }),
        yAxis({ opposite: false, labels: { align: 'right', x: -6, style: { color: '#ffca28' } }, gridLineWidth: 0 }),
      ],
      plotOptions: { ...base.plotOptions, column: { stacking: 'normal', borderWidth: 0, pointPadding: 0.05, groupPadding: 0 } },
      tooltip: { ...base.tooltip, valueDecimals: 2 },
      series: [
        { type: 'column', name: t('common.short'), data: data.map(d => [d.t, d.short * 100]), color: SHORT, tooltip: { valueSuffix: '%' } },
        { type: 'column', name: t('common.long'), data: data.map(d => [d.t, d.long * 100]), color: LONG, tooltip: { valueSuffix: '%' } },
        { type: 'line', name: t('common.ratio'), data: data.map(d => [d.t, d.ratio]), color: '#ffca28', yAxis: 1, lineWidth: 2 },
      ],
    };
  }, [history.data, t]);

  return (
    <>
      <PageHeader title={t('ls.title')} desc={t('ls.desc')} />
      <Tabs value={coin} onChange={(_, v) => setCoin(v)} sx={{ mb: 2 }}>
        {COINS.map(c => <Tab key={c} value={c} label={c === 'BTC' ? 'Bitcoin' : 'Ethereum'} />)}
      </Tabs>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
        <Box>
          <Panel title={t('ls.current')}>
            {EXCHANGES.map((e, i) => <RatioBar key={e.id} label={e.label} long={current.data?.[i]?.long} short={current.data?.[i]?.short} />)}
          </Panel>
          <Panel title={t('ls.ratioHistory')}>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
              <ToggleButtonGroup size="small" exclusive value={exchange} onChange={(_, v) => v && setExchange(v)}>
                {EXCHANGES.map(e => <ToggleButton key={e.id} value={e.id} sx={{ fontSize: 12, py: 0.3 }}>{e.label}</ToggleButton>)}
              </ToggleButtonGroup>
              <ButtonGroup size="small" color="inherit">
                {PERIODS[exchange].map(x => (
                  <Button key={x} variant={x === p ? 'contained' : 'outlined'} color={x === p ? 'primary' : 'inherit'}
                    onClick={() => setPeriod(x)} sx={{ minWidth: 0, px: 1, fontSize: 12 }}>{x}</Button>
                ))}
              </ButtonGroup>
            </Stack>
            <ChartState loading={history.loading} error={history.error} height={420}>
              <StockChart ref={chartRef} options={options} />
            </ChartState>
          </Panel>
        </Box>
        <WhaleFeed coin={coin} />
      </Box>
    </>
  );
};

export default LongShort;
