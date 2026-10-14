import React, { useMemo } from 'react';
import CardGridPage from '../components/CardGridPage';
import { useI18n } from '../i18n';
import { marketItems } from '../lib/catalog';

/** 마켓 페이지: 자산별 단일 차트 카드 */
const Markets: React.FC = () => {
  const { t } = useI18n();
  const items = useMemo(() => marketItems(), []);
  return (
    <CardGridPage
      name={t('markets.title')}
      menuTitle={t('markets.title')}
      items={items}
      storageKey="marketFavorites"
      titleFor={item => item.label}
    />
  );
};

export default Markets;
