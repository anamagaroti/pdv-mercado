import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface PageHeaderProps {
  titulo: string;
  subtitulo?: string;
  acoes?: React.ReactNode;
}

export default function PageHeader({ titulo, subtitulo, acoes }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        py: 2,
        borderBottom: `1px solid ${tokens.color.border}`,
        bgcolor: tokens.color.bgSurface,
        flexShrink: 0,
      }}
    >
      <Box>
        <Typography
          variant="h6"
          sx={{ fontFamily: tokens.font.display, fontWeight: 600, lineHeight: 1.2 }}
        >
          {titulo}
        </Typography>
        {subtitulo && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {subtitulo}
          </Typography>
        )}
      </Box>
      {acoes && <Box sx={{ display: 'flex', gap: 1 }}>{acoes}</Box>}
    </Box>
  );
}
