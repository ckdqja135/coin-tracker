import React, { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { useI18n } from '../i18n';

const hexToRgba = (hex: string) => {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 1)`;
};

interface Props {
  /** embed-widget-*.js 이름 (예: advanced-chart, events) */
  widget: string;
  config: Record<string, unknown>;
  height: number;
}

/** TradingView 공개 임베드 위젯 */
const TradingViewWidget: React.FC<Props> = ({ widget, config, height }) => {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  // 위젯 언어는 사이트 언어를 따른다
  const locale = useI18n().lang === 'ko' ? 'kr' : 'en';
  const mode = theme.palette.mode;
  // 위젯은 hex 대신 rgba 형식의 색만 받는다
  const bg = hexToRgba(theme.palette.background.paper);
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
      // 투명 배경은 다크 모드에서 위젯 기본 흰 배경이 비치므로 테마 배경색을 직접 지정한다
      script.innerHTML = JSON.stringify({
        // 차트(advanced-chart) 위젯은 theme, 캘린더 등 다른 위젯은 colorTheme을 쓴다
        ...config, theme: mode, colorTheme: mode, isTransparent: false, backgroundColor: bg,
        gridColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        width: '100%', height: '100%', locale,
      });
      container.appendChild(script);
    }, 0);
    el.appendChild(container);
    return () => {
      clearTimeout(timer);
      // 위젯이 만든 iframe은 컨테이너째 떼어내기만 하고 스크립트 내부 상태는 건드리지 않는다
      container.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget, configKey, mode, bg, locale]);

  return <div ref={ref} style={{ height, width: '100%' }} />;
};

export default TradingViewWidget;
