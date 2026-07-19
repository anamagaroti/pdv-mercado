import { useState } from 'react';
import {
  Box,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  Pagination,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Button,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '../components/layout/PageHeader';
import { produtosApi } from '../api';
import { useDebounce } from '../hooks/useDebounce';
import { tokens } from '../theme/tokens';

const TAMANHO_PAGINA = 50;

export default function ProdutosPage() {
  const [termo, setTermo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<'todos' | 'sem_ncm' | 'sem_situacao'>('todos');
  const [exportando, setExportando] = useState(false);

  const termoDebounced = useDebounce(termo, 300);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['produtos', termoDebounced, pagina, filtro],
    queryFn: () =>
      produtosApi.listar({
        termo: termoDebounced || undefined,
        pagina,
        tamanhoPagina: TAMANHO_PAGINA,
        semNcm: filtro === 'sem_ncm',
        semSituacaoTributaria: filtro === 'sem_situacao',
      }),
    placeholderData: (prev) => prev,
  });

  const totalPaginas = data ? Math.ceil(data.total / TAMANHO_PAGINA) : 1;

  const formatarPreco = (preco: number | null) =>
    preco === null ? '—' : preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  /**
   * Exporta os produtos atualmente filtrados para Excel.
   * Usa fetch direto para receber o arquivo binário e dispara o download.
   */
  const handleExportar = async () => {
    setExportando(true);
    try {
      const params = new URLSearchParams();
      if (termoDebounced) params.set('termo', termoDebounced);
      if (filtro === 'sem_ncm') params.set('semNcm', 'true');
      if (filtro === 'sem_situacao') params.set('semSituacaoTributaria', 'true');

      const resp = await fetch(`/api/produtos/exportar?${params.toString()}`);
      if (!resp.ok) throw new Error('Erro ao exportar');

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dataHoje = new Date().toISOString().slice(0, 10);
      a.download = `produtos-${dataHoje}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silencia — o usuário vai ver que o download não aconteceu
    } finally {
      setExportando(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        titulo="Produtos"
        subtitulo={data ? `${data.total.toLocaleString('pt-BR')} produtos na base` : undefined}
        acoes={
          <Button
            variant="outlined"
            size="small"
            startIcon={exportando ? <CircularProgress size={14} /> : <DownloadIcon />}
            disabled={exportando}
            onClick={handleExportar}
          >
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </Button>
        }
      />

      <Box sx={{ px: 3, py: 2, display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
        <TextField
          placeholder="Buscar por código, descrição, NCM ou marca..."
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setPagina(1);
          }}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: tokens.color.textTertiary }} />
              </InputAdornment>
            ),
            endAdornment: isFetching ? (
              <InputAdornment position="end">
                <CircularProgress size={14} />
              </InputAdornment>
            ) : undefined,
          }}
          sx={{ maxWidth: 480 }}
        />

        <ToggleButtonGroup
          size="small"
          exclusive
          value={filtro}
          onChange={(_, v) => {
            if (v) {
              setFiltro(v);
              setPagina(1);
            }
          }}
        >
          <ToggleButton value="todos">Todos</ToggleButton>
          <ToggleButton value="sem_ncm">Sem NCM</ToggleButton>
          <ToggleButton value="sem_situacao">Sem ST</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 3 }}>
        <TableContainer component={Paper} sx={{ borderRadius: tokens.radius.md + 'px' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Código de barras</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell align="right">Preço de custo</TableCell>
                <TableCell align="right">Preço de venda</TableCell>
                <TableCell>NCM</TableCell>
                <TableCell>Situação tributária</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.produtos ?? []).map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                    {p.codigo_barras ?? '—'}
                  </TableCell>
                  <TableCell>{p.descricao}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: tokens.font.mono }}>
                    {formatarPreco(p.preco_custo ?? 0)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: tokens.font.mono }}>
                    {formatarPreco(p.preco ?? 0)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                    {p.ncm || (
                      <Chip
                        size="small"
                        label="ausente"
                        sx={{
                          bgcolor: tokens.color.statusSemNcmMuted,
                          color: tokens.color.statusSemNcm,
                          fontSize: 10,
                          height: 18,
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{p.situacao_tributaria || '—'}</TableCell>
                  
                </TableRow>
              ))}
              {!isLoading && (data?.produtos.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: tokens.color.textTertiary }}>
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, flexShrink: 0 }}>
        <Pagination
          count={totalPaginas}
          page={pagina}
          onChange={(_, p) => setPagina(p)}
          color="primary"
          size="small"
        />
      </Box>
    </Box>
  );
}
