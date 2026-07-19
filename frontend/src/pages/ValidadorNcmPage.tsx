import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/layout/PageHeader';
import StatusNcmChip from '../components/cadastro/StatusNcmChip';
import PainelCorrecaoNcm from '../components/ncm/PainelCorrecaoNcm';
import { ncmApi, StatusNcm, ResultadoValidacaoNcm } from '../api';
import { tokens } from '../theme/tokens';

function CardEstatistica({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number | string;
  cor?: string;
}) {
  return (
    <Paper
      sx={{
        flex: 1,
        p: 2,
        borderRadius: tokens.radius.md + 'px',
        bgcolor: tokens.color.bgSurfaceRaised,
        minWidth: 120,
      }}
    >
      <Typography
        variant="h5"
        sx={{ fontFamily: tokens.font.display, fontWeight: 700, color: cor ?? tokens.color.textPrimary }}
      >
        {valor}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export default function ValidadorNcmPage() {
  const [filtro, setFiltro] = useState<StatusNcm | 'todos'>('todos');
  const [aba, setAba] = useState<'resultados' | 'corrigir'>('resultados');
  const queryClient = useQueryClient();

  const ultimaValidacao = useQuery({
    queryKey: ['ultima-validacao-ncm'],
    queryFn: ncmApi.ultimaValidacao,
  });

  const mutationValidar = useMutation({
    mutationFn: () => ncmApi.validarTodos({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncm-problematicos'] });
    },
  });

  const resultadosBrutos = mutationValidar.data?.resultados ?? ultimaValidacao.data ?? [];
  const resultados: ResultadoValidacaoNcm[] = Array.isArray(resultadosBrutos) ? resultadosBrutos : [];

  const estatisticas = mutationValidar.data?.estatisticas;

  const temProblemas = resultados.some(
    (r) => r.status === 'invalido' || r.status === 'nao_encontrado'
  );

  const resultadosFiltrados =
    filtro === 'todos' ? resultados : resultados.filter((r) => r.status === filtro);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        titulo="Validador de NCM"
        subtitulo="Verifica se os NCMs cadastrados existem oficialmente no Portal Siscomex"
        acoes={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {temProblemas && (
              <Button
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                onClick={() => setAba('corrigir')}
                sx={{
                  borderColor: tokens.color.scan,
                  color: tokens.color.scan,
                  '&:hover': { borderColor: tokens.color.scan, bgcolor: tokens.color.scanMuted },
                }}
              >
                Analisar e corrigir
              </Button>
            )}
            <Button
              variant="contained"
              startIcon={<FactCheckIcon />}
              onClick={() => {
                mutationValidar.mutate();
                setAba('resultados');
              }}
              disabled={mutationValidar.isPending}
            >
              {mutationValidar.isPending ? 'Validando...' : 'Validar todos os NCMs'}
            </Button>
          </Box>
        }
      />

      {mutationValidar.isPending && <LinearProgress sx={{ height: 2, flexShrink: 0 }} />}

      {ultimaValidacao.isError && !mutationValidar.data && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Typography variant="body2" color="error">
            Não foi possível carregar a última validação salva: {(ultimaValidacao.error as any)?.response?.data?.mensagem ?? (ultimaValidacao.error as any)?.message ?? 'erro desconhecido'}.
            Abra o DevTools (aba Network) e confira o que <code>/api/ncm/ultima-validacao</code> está devolvendo.
          </Typography>
        </Box>
      )}

      {mutationValidar.isError && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Typography variant="body2" color="error">
            Não foi possível validar: a fonte oficial (Portal Siscomex) pode estar indisponível.
            Tente novamente em instantes.
          </Typography>
        </Box>
      )}

      {estatisticas && (
        <Box sx={{ display: 'flex', gap: 2, px: 3, py: 2, flexShrink: 0, flexWrap: 'wrap' }}>
          <CardEstatistica label="Total de produtos" valor={estatisticas.total_produtos} />
          <CardEstatistica
            label="NCMs válidos"
            valor={estatisticas.total_validos}
            cor={tokens.color.statusValido}
          />
          <CardEstatistica
            label="Não encontrados"
            valor={estatisticas.total_nao_encontrados}
            cor={tokens.color.statusNaoEncontrado}
          />
          <CardEstatistica
            label="Inválidos"
            valor={estatisticas.total_invalidos}
            cor={tokens.color.statusInvalido}
          />
          <CardEstatistica label="Sem NCM" valor={estatisticas.total_sem_ncm} cor={tokens.color.statusSemNcm} />
          <CardEstatistica
            label="Tempo da verificação"
            valor={`${(estatisticas.tempo_ms / 1000).toFixed(1)}s`}
          />
        </Box>
      )}

      {/* Abas: Resultados / Analisar e corrigir */}
      <Box sx={{ px: 3, borderBottom: `1px solid ${tokens.color.border}`, flexShrink: 0 }}>
        <Tabs
          value={aba}
          onChange={(_, v) => setAba(v)}
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: tokens.color.accent } }}
        >
          <Tab value="resultados" label="Resultados" />
          {temProblemas && (
            <Tab
              value="corrigir"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <AutoFixHighIcon sx={{ fontSize: 16, color: tokens.color.scan }} />
                  <span>Analisar e corrigir</span>
                </Box>
              }
            />
          )}
        </Tabs>
      </Box>

      {/* Aba: Resultados */}
      {aba === 'resultados' && (
        <>
          <Box sx={{ px: 3, py: 1.5, flexShrink: 0 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filtro}
              onChange={(_, v) => v && setFiltro(v)}
            >
              <ToggleButton value="todos">Todos ({resultados.length})</ToggleButton>
              <ToggleButton value="valido">Válidos</ToggleButton>
              <ToggleButton value="nao_encontrado">Não encontrados</ToggleButton>
              <ToggleButton value="invalido">Inválidos</ToggleButton>
              <ToggleButton value="sem_ncm">Sem NCM</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', px: 3, pb: 3 }}>
            <TableContainer component={Paper} sx={{ borderRadius: tokens.radius.md + 'px' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Produto</TableCell>
                    <TableCell>Código</TableCell>
                    <TableCell>NCM</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resultadosFiltrados.map((r) => (
                    <TableRow key={r.produto_id} hover>
                      <TableCell>{r.descricao}</TableCell>
                      <TableCell sx={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                        {r.codigo_barras ?? '—'}
                      </TableCell>
                      <TableCell sx={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                        {r.ncm ?? '—'}
                      </TableCell>
                      <TableCell>
                        <StatusNcmChip status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {resultadosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6, color: tokens.color.textTertiary }}>
                        {resultados.length === 0
                          ? 'Clique em "Validar todos os NCMs" para começar.'
                          : 'Nenhum resultado para este filtro.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </>
      )}

      {/* Aba: Analisar e corrigir */}
      {aba === 'corrigir' && (
        <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2 }}>
          <PainelCorrecaoNcm
            onCorrecaoAplicada={() => {
              mutationValidar.mutate();
              setAba('resultados');
            }}
          />
        </Box>
      )}
    </Box>
  );
}