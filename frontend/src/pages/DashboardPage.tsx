import { Box, Paper, Typography, Grid, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/layout/PageHeader';
import { dashboardApi } from '../api';
import { tokens } from '../theme/tokens';

function CardDashboard({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number | null;
  cor?: string;
}) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Paper
        sx={{
          p: 3,
          borderRadius: tokens.radius.lg + 'px',
          bgcolor: tokens.color.bgSurface,
          height: '100%',
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            color: valor === null ? tokens.color.textTertiary : cor ?? tokens.color.textPrimary,
          }}
        >
          {valor === null ? '—' : valor.toLocaleString('pt-BR')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {label}
          {valor === null && (
            <Typography component="span" variant="caption" sx={{ display: 'block', color: tokens.color.textTertiary }}>
              indisponível nesta base
            </Typography>
          )}
        </Typography>
      </Paper>
    </Grid>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.obterEstatisticas,
    refetchInterval: 60_000,
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader titulo="Dashboard" subtitulo="Visão geral da base de produtos" />

      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 3 }}>
        {isLoading || !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            <CardDashboard label="Total de produtos" valor={data.total_produtos} />
            <CardDashboard
              label="Cadastrados hoje"
              valor={data.produtos_cadastrados_hoje}
              cor={tokens.color.statusValido}
            />
            <CardDashboard
              label="Produtos novos (criados no sistema)"
              valor={data.produtos_novos_total}
              cor={tokens.color.accent}
            />
            <CardDashboard label="Alterados hoje" valor={data.produtos_alterados_hoje} />
            <CardDashboard label="NCMs diferentes" valor={data.quantidade_ncms_diferentes} />
            <CardDashboard
              label="Produtos sem NCM"
              valor={data.produtos_sem_ncm}
              cor={tokens.color.statusNaoEncontrado}
            />
            <CardDashboard
              label="Produtos sem situação tributária"
              valor={data.produtos_sem_situacao_tributaria}
              cor={tokens.color.statusInvalido}
            />
          </Grid>
        )}
      </Box>
    </Box>
  );
}