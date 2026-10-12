import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';

interface Props {
  /** embed-widget-*.js 이름 (예: advanced-chart, events) */
  widget: string;
  config: Record<string, unknown>;
  height: number;
}

/** TradingView 공개 임베드 위젯 */
const TradingViewWidget: React.FC<Props> = ({ widget, config, height }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useTheme().palette.mode;
  const configKey = JSON.stringify(config);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // StrictMode 이중 마운트 대비: 첫 마운트 직후 정리되면 스크립트를 붙이지 않는다
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.cssText = 'height:100%;width:100%';
    container.innerHTML = '<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>';
    const timer = setTimeout(() => {
      const script = document.createElement('script');
      script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
      script.async = true;
      script.innerHTML = JSON.stringify({ ...config, colorTheme: mode, isTransparent: true, width: '100%', height: '100%', locale: 'kr' });
      container.appendChild(script);
    }, 0);
    el.appendChild(container);
    return () => {
      clearTimeout(timer);
      // 위젯이 만든 iframe은 컨테이너째 떼어내기만 하고 스크립트 내부 상태는 건드리지 않는다
      container.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget, configKey, mode]);

  return <div ref={ref} style={{ height, width: '100%' }} />;
};

export default TradingViewWidget;
