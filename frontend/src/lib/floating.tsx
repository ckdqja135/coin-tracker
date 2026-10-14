import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * 화면 오른쪽 아래 플로팅 버튼 줄 (Tools · Chat)
 * - 패널은 한 번에 하나만 열린다 (panel).
 */
export type FloatingPanel = 'chat' | 'tools' | null;

interface FloatingValue {
  panel: FloatingPanel;
  setPanel: (p: FloatingPanel) => void;
  toggle: (p: Exclude<FloatingPanel, null>) => void;
}

const FloatingContext = createContext<FloatingValue>({ panel: null, setPanel: () => {}, toggle: () => {} });

export const FloatingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [panel, setPanel] = useState<FloatingPanel>(null);
  const value = useMemo(() => ({
    panel, setPanel,
    toggle: (p: Exclude<FloatingPanel, null>) => setPanel(cur => (cur === p ? null : p)),
  }), [panel]);
  return <FloatingContext.Provider value={value}>{children}</FloatingContext.Provider>;
};

export const useFloating = () => useContext(FloatingContext);

/** 플로팅 패널 공통 위치 (버튼 줄 바로 위) */
export const panelSx = {
  position: 'fixed', right: { xs: 8, sm: 28 }, bottom: 84, zIndex: 1250,
  width: { xs: 'calc(100vw - 16px)', sm: 400 }, maxHeight: 'calc(100vh - 120px)',
  borderRadius: '18px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  bgcolor: 'background.paper', border: 1, borderColor: 'divider',
  boxShadow: '0 20px 50px rgba(17,24,39,.18), 0 2px 8px rgba(17,24,39,.06)',
} as const;

/** 플로팅 버튼 공통 모양 */
export const fabSx = {
  height: 52, px: 2.5, borderRadius: 99, fontSize: 16, fontWeight: 700, textTransform: 'none', gap: 1,
  boxShadow: '0 6px 18px rgba(17,24,39,.14)',
} as const;
