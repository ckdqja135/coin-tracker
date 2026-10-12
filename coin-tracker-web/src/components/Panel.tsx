import React from 'react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import { useI18n } from '../i18n';

interface Props {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const Panel: React.FC<Props> = ({ title, subtitle, actions, children }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 2, bgcolor: 'background.paper' }}>
    {(title || actions) && (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flexGrow: 1 }}>
          {title && <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{title}</Typography>}
          {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
        </Box>
        {actions}
      </Box>
    )}
    {children}
  </Paper>
);

/** 차트 영역 로딩/에러 상태 표시 */
export const ChartState: React.FC<{ loading: boolean; error: string | null; height?: number; children: React.ReactNode }> = ({
  loading, error, height = 480, children,
}) => {
  const { t } = useI18n();
  if (error) return <Alert severity="error" sx={{ my: 2 }}>{t('common.error')}: {error}</Alert>;
  return (
    <Box sx={{ position: 'relative', minHeight: height }}>
      {children}
      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
          <CircularProgress size={32} />
        </Box>
      )}
    </Box>
  );
};

export const PageHeader: React.FC<{ title: string; desc?: string }> = ({ title, desc }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 } }}>{title}</Typography>
    {desc && <Typography color="text.secondary">{desc}</Typography>}
  </Box>
);
