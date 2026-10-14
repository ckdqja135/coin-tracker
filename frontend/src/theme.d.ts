import '@mui/material/styles';

/** 영역별 배경/글자색. 라이트 모드는 토스풍(흰 배경 + 파란 포인트), 다크 모드는 기존 어두운 톤 */
export interface UiTokens {
  header: { bg: string; fg: string; muted: string; active: string; border: string };
  ticker: { bg: string; fg: string; muted: string; border: string };
  sidebar: {
    bg: string; fg: string; muted: string; title: string; group: string; border: string;
    activeBg: string; activeFg: string; inputBorder: string; badgeBg: string; badgeFg: string;
  };
  card: { bg: string; fg: string; muted: string; border: string; divider: string; iconBorder: string; radius: number };
  chip: { bg: string; fg: string; activeBg: string; activeFg: string; hover: string };
  /** 본문 위 버튼·선택상자·칩 */
  pill: { bg: string; fg: string; hover: string };
  /** 비교표 기준 거래소 열 등 강조 영역 */
  highlight: { bg: string; fg: string };
  footer: { bg: string; fg: string; muted: string; title: string; border: string };
}

declare module '@mui/material/styles' {
  interface Palette {
    surface: {
      inverse: string;
      inverseHover: string;
      track: string;
      empty: string;
      chartBg: string;
    };
    ui: UiTokens;
  }
  interface PaletteOptions {
    surface?: Partial<Palette['surface']>;
    ui?: UiTokens;
  }
}
