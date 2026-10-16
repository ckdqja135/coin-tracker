import React, { useMemo, useState } from 'react';
import { Autocomplete, Box, InputAdornment, TextField } from '@mui/material';
import { useI18n } from '../i18n';
import { NewBadge, useNewListings } from '../lib/newListings';
import { useAsync } from '../lib/useAsync';
import { CoinListItem, fetchCoinList } from '../services/market';

let coinListCache: Promise<CoinListItem[]> | null = null;
const loadCoinList = () => {
  if (!coinListCache) coinListCache = fetchCoinList().catch(e => { coinListCache = null; throw e; });
  return coinListCache;
};

interface Props {
  onSelect: (symbol: string) => void;
  size?: 'large' | 'small';
}

/** 코인 심볼/영문명/한글명으로 검색 */
const CoinSearch: React.FC<Props> = ({ onSelect, size = 'small' }) => {
  const { t, lang } = useI18n();
  const { data } = useAsync(loadCoinList, []);
  const [input, setInput] = useState('');
  const fresh = useNewListings();

  const options = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q || !data) return [];
    // 정확히 일치 > 심볼 접두어(짧은 순) > 이름 포함
    const exact = data.filter(c => c.symbol.toLowerCase() === q);
    const starts = data
      .filter(c => c.symbol.toLowerCase() !== q && c.symbol.toLowerCase().startsWith(q))
      .sort((a, b) => a.symbol.length - b.symbol.length);
    const rest = data.filter(c => !c.symbol.toLowerCase().startsWith(q)
      && (c.en.toLowerCase().includes(q) || (c.ko ?? '').includes(q)));
    return [...exact, ...starts, ...rest].slice(0, 20);
  }, [input, data]);

  const large = size === 'large';
  return (
    <Autocomplete<CoinListItem, false, false, false>
      options={options}
      filterOptions={x => x}
      inputValue={input}
      onInputChange={(_, v, reason) => reason !== 'reset' && setInput(v)}
      value={null}
      onChange={(_, c) => { if (c) { onSelect(c.symbol); setInput(''); } }}
      getOptionLabel={c => c.symbol}
      noOptionsText={input ? t('search.empty') : t('search.coins')}
      renderOption={(props, c) => (
        <Box component="li" {...props} key={c.symbol} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <b>{c.symbol}</b>
          <Box component="span" sx={{ color: 'text.secondary' }}>{lang === 'ko' && c.ko ? c.ko : c.en}</Box>
          {fresh.get(c.symbol) && <NewBadge info={fresh.get(c.symbol)!} withExchange />}
        </Box>
      )}
      fullWidth
      renderInput={params => (
        <TextField
          {...params}
          placeholder={t('search.coins')}
          InputProps={{
            ...params.InputProps,
            endAdornment: <InputAdornment position="end">🔍</InputAdornment>,
            sx: {
              borderRadius: 99, fontStyle: input ? 'normal' : 'italic',
              ...(large ? { height: 56, px: 2, fontSize: 17 } : { height: 38, px: 1.5 }),
              '& fieldset': { borderColor: 'primary.main', borderWidth: 2 },
            },
          }}
        />
      )}
    />
  );
};

export default CoinSearch;
