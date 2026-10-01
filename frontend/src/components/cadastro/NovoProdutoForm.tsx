import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  MenuItem,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  Alert,
  InputAdornment,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import { useQuery } from '@tanstack/react-query';
import { buscaApi, ncmApi, Produto, SugestaoNcm, SugestaoSimilar, listasApoioApi } from '../../api';
import { useDebounce } from '../../hooks/useDebounce';
import { tokens } from '../../theme/tokens';
import SugestoesSimilaridade from './SugestoesSimilaridade';
import { useSituacaoTributaria } from "../../hooks/useSituacaoTributaria";

interface NovoProdutoFormProps {
  codigoBarras?: string;
  salvando: boolean;
  onSalvar: (dados: Partial<Produto>) => void;
  onCancelar: () => void;
}

export default function NovoProdutoForm({
  codigoBarras,
  salvando,
  onSalvar,
  onCancelar,
}: NovoProdutoFormProps) {
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [ncm, setNcm] = useState('');
  const [situacaoTributaria, setSituacaoTributaria] = useState('');
  const [campoFiscalDe, setCampoFiscalDe] = useState<string | null>(null);
  const [mostrarSugestoesNcm, setMostrarSugestoesNcm] = useState(false);
  const { options, toBackend, fromBackend } = useSituacaoTributaria();
  const [codigoBarrasLocal, setCodigoBarrasLocal] = useState(codigoBarras ?? "");

  // 1) Tentativa de busca externa pelo código de barras
  const consultaExterna = useQuery({
   queryKey: ['codigo-externo', codigoBarrasLocal],
queryFn: () => buscaApi.codigoExterno(codigoBarrasLocal),
enabled: codigoBarrasLocal.length >= 8,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
  if (consultaExterna.data?.encontrado && consultaExterna.data.descricao) {
    setDescricao(consultaExterna.data.descricao);
  }
}, [consultaExterna.data]);

  // 2) Busca de produtos similares conforme o operador digita a descrição
  const descricaoDebounced = useDebounce(descricao, 350);
  const buscaSimilares = useQuery({
    queryKey: ['similares', descricaoDebounced],
    queryFn: () => buscaApi.similares(descricaoDebounced),
    enabled: descricaoDebounced.trim().length >= 3,
  });

  // 3) Busca de NCM no Siscomex pela descrição do produto (acionada pelo botão)
  const buscaNcmSiscomex = useQuery({
    queryKey: ['ncm-descricao', descricaoDebounced],
    queryFn: () => ncmApi.buscarPorDescricao(descricaoDebounced),
    enabled: false, // só roda quando o usuário clicar no botão
  });

  // 4) Lista de situações tributárias válidas (é FK — texto livre quebra o INSERT)
  const { data: situacoesTributarias = [] } = useQuery({
    queryKey: ['situacoes-tributarias'],
    queryFn: listasApoioApi.situacoesTributarias,
    staleTime: 5 * 60_000,
  });

  const handleBuscarNcm = () => {
    setMostrarSugestoesNcm(true);
    buscaNcmSiscomex.refetch();
  };

  const handleSelecionarNcmSiscomex = (sugestao: SugestaoNcm) => {
    setNcm(sugestao.codigo);
    setMostrarSugestoesNcm(false);
    // Se a descrição ainda estiver vazia, preenche com a descrição oficial do Siscomex
    // formatada de forma mais amigável (remove siglas de capítulo em maiúsculas)
    if (!descricao.trim() && sugestao.descricao) {
      const descOficial = sugestao.descricao
        .replace(/^[-–—\s]+/, '') // remove traços iniciais
        .trim();
      if (descOficial.length > 0) setDescricao(descOficial);
    }
  };

  const handleSelecionarSimilar = (sugestao: SugestaoSimilar) => {
    setNcm(sugestao.produto.ncm ?? '');
    setDescricao(sugestao.produto.descricao ?? '');
    setSituacaoTributaria(sugestao.produto.situacao_tributaria ?? '');
    setCampoFiscalDe(sugestao.produto.descricao);
    setMostrarSugestoesNcm(false);
  };

  const handleSalvar = () => {
    onSalvar({
      codigo_barras: codigoBarras || codigoBarrasLocal,
      descricao,
      preco: preco ? parseFloat(preco.replace(',', '.')) : undefined,
      ncm: ncm || undefined,
      situacao_tributaria:
        situacaoTributaria
          ? toBackend(situacaoTributaria)
          : undefined,
    });
  };

  const podeSalvar = descricao.trim().length > 0 && preco.trim().length > 0;
  const podeNcm = descricao.trim().length >= 3;

  return (
    <Paper sx={{ p: 3, borderRadius: tokens.radius.lg + 'px', bgcolor: tokens.color.bgSurface }}>
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Chip
          size="small"
          icon={<SearchOffIcon sx={{ fontSize: '14px !important' }} />}
          label="Código não encontrado — cadastro rápido"
          sx={{
            bgcolor: tokens.color.scanMuted,
            color: tokens.color.scan,
            fontWeight: 600,
            '& .MuiChip-icon': { color: tokens.color.scan },
          }}
        />
      </Box>

      <TextField
  label="Código de barras *"
  fullWidth
  autoFocus
  value={codigoBarrasLocal}
  onChange={(e) => setCodigoBarrasLocal(e.target.value)}
  onKeyDown={async (e) => {
    if (e.key !== "Enter") return;

    try {
      const resultado = await buscaApi.codigoExterno(codigoBarrasLocal);

      if (resultado.encontrado && resultado.descricao) {
        setDescricao(resultado.descricao);
      }
    } catch (err) {
      console.error(err);
    }
  }}
  InputProps={{
    startAdornment: (
      <InputAdornment position="start">
        <QrCodeIcon />
      </InputAdornment>
    ),
  }}
/>

      {/* Retorno da API externa */}
      {consultaExterna.isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            Consultando base externa de produtos...
          </Typography>
        </Box>
      )}
      {consultaExterna.data?.encontrado && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: tokens.color.accent }} />
          <Typography variant="caption" sx={{ color: tokens.color.accent }}>
            Descrição preenchida via {consultaExterna.data.fonte}
          </Typography>
        </Box>
      )}

      <Grid container spacing={2}>
        {/* Descrição */}
        <Grid item xs={12}>
          <TextField
            label="Nome do produto *"
            fullWidth
            autoFocus
            value={descricao}
            onChange={(e) => {
              setDescricao(e.target.value);
              setMostrarSugestoesNcm(false);
            }}
            placeholder="Digite o nome do produto..."
          />
        </Grid>
      </Grid>

      {/* Sugestões de produtos similares (para copiar campos fiscais) */}
      {descricaoDebounced.trim().length >= 3 && (
        <SugestoesSimilaridade
          sugestoes={buscaSimilares.data ?? []}
          carregando={buscaSimilares.isLoading}
          onSelecionar={handleSelecionarSimilar}
        />
      )}

      {campoFiscalDe && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: tokens.color.statusValido }} />
          <Typography variant="caption" sx={{ color: tokens.color.statusValido }}>
            Dados fiscais copiados de "{campoFiscalDe}"
          </Typography>
        </Box>
      )}

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {/* Preço de venda */}
        <Grid item xs={6} sm={3}>
          <TextField
            label="Preço de venda *"
            fullWidth
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
          />
        </Grid>

        {/* NCM com botão de busca no Siscomex */}
        <Grid item xs={12} sm={5}>
          <TextField
            label="NCM"
            fullWidth
            value={ncm}
            onChange={(e) => setNcm(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleBuscarNcm}
                    disabled={!podeNcm || buscaNcmSiscomex.isFetching}
                    startIcon={
                      buscaNcmSiscomex.isFetching ? (
                        <CircularProgress size={12} />
                      ) : (
                        <ManageSearchIcon sx={{ fontSize: 16 }} />
                      )
                    }
                    sx={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: tokens.color.accent,
                      whiteSpace: 'nowrap',
                      px: 0.75,
                      minWidth: 0,
                    }}
                  >
                    {buscaNcmSiscomex.isFetching ? 'Buscando...' : 'Buscar no Siscomex'}
                  </Button>
                </InputAdornment>
              ),
            }}
          />

          {/* Dropdown de sugestões de NCM */}
          <Collapse in={mostrarSugestoesNcm && (buscaNcmSiscomex.data ?? []).length > 0}>
            <Paper
              sx={{
                mt: 0.5,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: tokens.radius.sm + 'px',
                overflow: 'hidden',
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {buscaNcmSiscomex.isError && (
                <Alert severity="warning" sx={{ m: 1 }}>
                  Não foi possível conectar ao Siscomex. Tente novamente.
                </Alert>
              )}
              <List dense disablePadding>
                {(buscaNcmSiscomex.data ?? []).map((s) => (
                  <ListItemButton
                    key={s.codigo}
                    onClick={() => handleSelecionarNcmSiscomex(s)}
                    sx={{ borderBottom: `1px solid ${tokens.color.border}` }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: tokens.font.mono,
                              fontWeight: 700,
                              color: tokens.color.accent,
                              flexShrink: 0,
                            }}
                          >
                            {s.codigo}
                          </Typography>
                          <Typography variant="body2" noWrap>
                            {s.descricao}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Collapse>

          {mostrarSugestoesNcm &&
            !buscaNcmSiscomex.isFetching &&
            (buscaNcmSiscomex.data ?? []).length === 0 && (
              <Alert severity="info" sx={{ mt: 0.5, py: 0.5, fontSize: 12 }}>
                Nenhum NCM encontrado para essa descrição.
              </Alert>
            )}
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
  label="Situação tributária"
  select
  fullWidth
  value={situacaoTributaria}
  onChange={(e) => setSituacaoTributaria(e.target.value)}
>
  <MenuItem value="">— nenhuma —</MenuItem>

  {options.map((o) => (
    <MenuItem key={o.value} value={o.value}>
      {o.label}
    </MenuItem>
  ))}
</TextField>
        </Grid>
      </Grid>

      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: tokens.color.textTertiary }}>
        Preço de custo e outras tabelas de preço ficam disponíveis para edição depois de salvar o produto.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
        <Button onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!podeSalvar || salvando}
          onClick={handleSalvar}
        >
          {salvando ? 'Salvando...' : 'Salvar produto'}
        </Button>
      </Box>
    </Paper>
  );
}