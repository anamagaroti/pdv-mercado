import { Box, Paper, Typography, List, ListItemButton, LinearProgress } from '@mui/material';
import { SugestaoSimilar } from '../../api';
import { tokens } from '../../theme/tokens';

interface SugestoesSimilaridadeProps {
  sugestoes: SugestaoSimilar[];
  carregando: boolean;
  onSelecionar: (sugestao: SugestaoSimilar) => void;
}

export default function SugestoesSimilaridade({
  sugestoes,
  carregando,
  onSelecionar,
}: SugestoesSimilaridadeProps) {
  if (!carregando && sugestoes.length === 0) return null;

  return (
    <Paper
      sx={{
        mt: 2,
        borderRadius: tokens.radius.md + 'px',
        bgcolor: tokens.color.bgSurfaceRaised,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${tokens.color.border}` }}>
        <Typography variant="caption" sx={{ color: tokens.color.textTertiary, fontWeight: 600 }}>
          PRODUTOS PARECIDOS — clique para reaproveitar NCM / CEST / situação tributária
        </Typography>
      </Box>

      {carregando && <LinearProgress sx={{ height: 2 }} />}

      <List disablePadding>
        {sugestoes.map((s) => (
          <ListItemButton
            key={s.produto.id}
            onClick={() => onSelecionar(s)}
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: `1px solid ${tokens.color.border}`,
              '&:last-child': { borderBottom: 'none' },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                {s.produto.descricao}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 0.25 }}>
                {s.produto.grupo_imposto && (
                  <Typography variant="caption" color="text.secondary">
                    Grupo: {s.produto.grupo_imposto}
                  </Typography>
                )}
                {s.produto.ncm && (
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: tokens.font.mono, color: tokens.color.textTertiary }}
                  >
                    NCM: {s.produto.ncm}
                  </Typography>
                )}
                {s.produto.situacao_tributaria && (
                  <Typography variant="caption" color="text.secondary">
                    ST: {s.produto.situacao_tributaria}
                  </Typography>
                )}
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontFamily: tokens.font.mono,
                fontWeight: 700,
                color:
                  s.similaridade > 0.7
                    ? tokens.color.statusValido
                    : s.similaridade > 0.4
                    ? tokens.color.scan
                    : tokens.color.textTertiary,
                ml: 2,
                flexShrink: 0,
              }}
            >
              {Math.round(s.similaridade * 100)}%
            </Typography>
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}
