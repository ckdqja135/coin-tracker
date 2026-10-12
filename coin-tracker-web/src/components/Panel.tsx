import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

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

export const PageHeader: React.FC<{ title: string; desc?: string }> = ({ title, desc }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 } }}>{title}</Typography>
    {desc && <Typography color="text.secondary">{desc}</Typography>}
  </Box>
);
