import React, { useMemo } from 'react';
import CardGridPage from '../components/CardGridPage';
import { basePrice, vsTargets } from '../lib/catalog';

const NAMES = { BTC: 'Bitcoin', ETH: 'Ethereum' } as const;

/** BTC / ETH 페이지: 기준 코인 vs 여러 지표 비교 카드 */
const CoinPage: React.FC<{ coin: 'BTC' | 'ETH' }> = ({ coin }) => {
  const base = useMemo(() => basePrice(coin), [coin]);
  const items = useMemo(() => vsTargets(coin), [coin]);
  const name = NAMES[coin];
  return (
    <CardGridPage
      name={name}
      menuTitle={`${name} VS`}
      icon={coin}
      base={base}
      items={items}
      storageKey={`vsFavorites:${coin}`}
      titleFor={item => `${name}(${coin}) vs ${item.label}`}
    />
  );
};

export default CoinPage;
