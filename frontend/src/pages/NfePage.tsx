import { Fragment, useRef, useState } from 'react';
import {
  Box, Button, Paper, Typography, Chip, Grid, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  TextField, Checkbox, Alert, LinearProgress, Snackbar,
  InputAdornment, Tooltip, Tab, Tabs, IconButton,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SaveIcon from '@mui/icons-material/Save';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CodeIcon from '@mui/icons-material/Code';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/layout/PageHeader';
import { nfeApi, NfeCompleta, NfeItemEnriquecido, AplicarPrecoItem } from '../api';
import { tokens } from '../theme/tokens';

const BRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = (v: number) => `${v.toFixed(4)}%`;

interface ItemState {
  selecionado: boolean;
  margem: number;
  preco_venda: number;
  situacao_tributaria: string;
  unidade_tributavel: string;
  unidades_por_embalagem: string;
}

function calcPreco(custo: number, margem: number) {
  return Math.round(custo * (1 + margem / 100) * 100) / 100;
}

/**
 * Custo por unidade individual: se o operador informou quantos produtos vêm
 * em 1 unidade da nota (ex.: 12 unidades por FD), divide o custo da nota
 * (que é por FD) por essa quantidade. Sem essa informação, o custo
 * permanece como veio da nota (por FD mesmo).
 */
function custoPorUnidadeIndividual(custoUnitarioNota: number, unidadesPorEmbalagemStr: string): number {
  const n = parseFloat((unidadesPorEmbalagemStr || '').replace(',', '.'));
  if (!n || n <= 0) return custoUnitarioNota;
  return custoUnitarioNota / n;
}

function inicializarItens(itens: NfeItemEnriquecido[], margem: number): Record<number, ItemState> {
  const estado: Record<number, ItemState> = {};
  itens.forEach((item) => {
    const unidadesPorEmbalagem = item.unidades_por_embalagem?.toString() ?? '';
    const custoUnit = custoPorUnidadeIndividual(item.custo_unitario_calculado, unidadesPorEmbalagem);
    estado[item.numero_item] = {
      selecionado: true,
      margem,
      preco_venda: calcPreco(custoUnit, margem),
      situacao_tributaria: item.imposto.cst_icms ?? '',
      unidade_tributavel: item.unidade_tributavel ?? '',
      unidades_por_embalagem: unidadesPorEmbalagem,
    };
  });
  return estado;
}

// ── Painel de Certificado Digital ─────────────────────────────────────────

function PainelCertificado({ onFechar }: { onFechar: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [senha, setSenha] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['cert-status'],
    queryFn: nfeApi.certificadoStatus,
  });

  const mutUpload = useMutation({
    mutationFn: ({ arquivo, senha }: { arquivo: File; senha: string }) =>
      nfeApi.uploadCertificado(arquivo, senha),
    onSuccess: (res) => {
      setAviso(res.mensagem);
      queryClient.invalidateQueries({ queryKey: ['cert-status'] });
    },
    onError: (e: any) => setAviso(e?.response?.data?.mensagem ?? 'Erro ao salvar certificado.'),
  });

  const mutRemover = useMutation({
    mutationFn: nfeApi.removerCertificado,
    onSuccess: () => {
      setAviso('Certificado removido.');
      queryClient.invalidateQueries({ queryKey: ['cert-status'] });
    },
  });

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && senha) mutUpload.mutate({ arquivo: f, senha });
    else if (!senha) setAviso('Informe a senha antes de selecionar o arquivo.');
    e.target.value = '';
  };

  const status = statusQuery.data;

  return (
    <Paper sx={{ p: 3, mb: 2, borderRadius: tokens.radius.md + 'px', border: `1px solid ${tokens.color.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {status?.configurado ? (
          <LockIcon sx={{ color: tokens.color.statusValido }} />
        ) : (
          <LockOpenIcon sx={{ color: tokens.color.statusNaoEncontrado }} />
        )}
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Certificado Digital A1 (.pfx)
        </Typography>
        <Chip
          size="small"
          label={status?.configurado ? 'Configurado' : 'Não configurado'}
          sx={{
            bgcolor: status?.configurado ? tokens.color.statusValidoMuted : tokens.color.statusNaoEncontradoMuted,
            color: status?.configurado ? tokens.color.statusValido : tokens.color.statusNaoEncontrado,
            fontWeight: 700,
          }}
        />
        <Button size="small" sx={{ ml: 'auto' }} onClick={onFechar}>Fechar</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        O certificado é necessário para buscar NF-es automaticamente no SEFAZ do estado emissor.
        Sem ele, você ainda pode importar pelo XML ou PDF — a chave de acesso será decodificada
        e um link para o portal do SEFAZ será gerado para você baixar manualmente.
      </Typography>
      {aviso && <Alert severity={status?.configurado ? 'success' : 'warning'} sx={{ mb: 2 }}>{aviso}</Alert>}
      {!status?.configurado ? (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            label="Senha do certificado"
            type="password"
            size="small"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            sx={{ width: 240 }}
          />
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            disabled={!senha || mutUpload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {mutUpload.isPending ? 'Salvando...' : 'Selecionar .pfx'}
          </Button>
          <input ref={inputRef} type="file" accept=".pfx,.p12" hidden onChange={handleArquivo} />
        </Box>
      ) : (
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => mutRemover.mutate()}
          disabled={mutRemover.isPending}
        >
          Remover certificado
        </Button>
      )}
    </Paper>
  );
}

// ── Tela principal ─────────────────────────────────────────────────────────

export default function NfePage() {
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [modoImport, setModoImport] = useState<'barcode' | 'pdf' | 'xml'>('barcode');
  const [nfe, setNfe] = useState<NfeCompleta | null>(null);
  const [chaveInput, setChaveInput] = useState('');
  const [margemGlobal, setMargemGlobal] = useState('40');
  const [itensState, setItensState] = useState<Record<number, ItemState>>({});
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error' | 'warning'; texto: string; link?: string } | null>(null);
  const [expandidoIdx, setExpandidoIdx] = useState<number | null>(null);
  const [mostrarCert, setMostrarCert] = useState(false);
  const queryClient = useQueryClient();

  const processarNfe = (data: NfeCompleta) => {
    setNfe(data);
    const m = parseFloat(margemGlobal) || 40;
    setItensState(inicializarItens(data.itens, m));
  };

  const processarRespostaChave = (data: any) => {
    if (data.nfe) {
      processarNfe(data.nfe);
    } else if (data.chave) {
      // Dados parciais — sem certificado
      const dec = data.chave;
      setAviso({
        tipo: 'warning',
        texto: `Chave decodificada: NF-e ${dec.numero}/${dec.serie} — ${dec.ufNome} — ${dec.cnpjEmitente}. ${data.requerCertificado ? 'Configure o certificado digital para buscar automaticamente, ou acesse o portal do SEFAZ:' : data.mensagemSefaz ?? ''}`,
        link: dec.urlConsultaPortal,
      });
    }
  };

  const mutXml = useMutation({
    mutationFn: (f: File) => nfeApi.importar(f),
    onSuccess: processarNfe,
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.response?.data?.detalhe ?? 'Erro ao processar XML.' }),
  });

  const mutPdf = useMutation({
    mutationFn: (f: File) => nfeApi.porPdf(f),
    onSuccess: processarRespostaChave,
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.response?.data?.mensagem ?? 'Erro ao processar PDF.' }),
  });

  const mutChave = useMutation({
    mutationFn: (chave: string) => nfeApi.porChave(chave),
    onSuccess: (data) => {
      setChaveInput('');
      processarRespostaChave(data);
    },
    onError: (e: any) => setAviso({ tipo: 'error', texto: e?.response?.data?.mensagem ?? 'Erro ao consultar chave.' }),
  });

  const mutAplicar = useMutation({
    mutationFn: (itens: AplicarPrecoItem[]) => nfeApi.aplicarPrecos(itens),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAviso({ tipo: 'success', texto: `${res.atualizados} atualizado(s), ${res.criados} cadastrado(s).` });
    },
    onError: () => setAviso({ tipo: 'error', texto: 'Erro ao aplicar preços.' }),
  });

  const isLoading = mutXml.isPending || mutPdf.isPending || mutChave.isPending;

  const handleMargemGlobalChange = (v: string) => {
    setMargemGlobal(v);
    const m = parseFloat(v);
    if (isNaN(m) || !nfe) return;
    setItensState((prev) => {
      const next = { ...prev };
      nfe.itens.forEach((item) => {
        const cur = next[item.numero_item];
        const custoUnit = custoPorUnidadeIndividual(item.custo_unitario_calculado, cur.unidades_por_embalagem);
        next[item.numero_item] = {
          ...cur,
          margem: m,
          preco_venda: calcPreco(custoUnit, m),
        };
      });
      return next;
    });
  };

  const setItemField = (nItem: number, field: keyof ItemState, value: any) => {
    setItensState((prev) => {
      const cur = prev[nItem];
      const item = nfe?.itens.find((i) => i.numero_item === nItem);
      if (!item) return prev;
      const next = { ...cur, [field]: value };
      const custoUnit = custoPorUnidadeIndividual(
        item.custo_unitario_calculado,
        field === 'unidades_por_embalagem' ? String(value) : cur.unidades_por_embalagem
      );
      if (field === 'margem') next.preco_venda = calcPreco(custoUnit, Number(value));
      if (field === 'preco_venda' && custoUnit > 0)
        next.margem = Math.round(((Number(value) / custoUnit) - 1) * 10000) / 100;
      // Mudou "Un/embalagem": recalcula o preço de venda mantendo a margem atual
      if (field === 'unidades_por_embalagem') next.preco_venda = calcPreco(custoUnit, cur.margem);
      return { ...prev, [nItem]: next };
    });
  };

  const toggleTodos = (sel: boolean) =>
    setItensState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { next[Number(k)].selecionado = sel; });
      return next;
    });

  const handleAplicar = () => {
    if (!nfe) return;
    const itens: AplicarPrecoItem[] = nfe.itens
      .filter((i) => itensState[i.numero_item]?.selecionado)
      .map((item) => {
        const s = itensState[item.numero_item];
        const unidadesPorEmbalagemNum = s.unidades_por_embalagem
          ? parseFloat(s.unidades_por_embalagem.replace(',', '.'))
          : null;
        const custoUnit = custoPorUnidadeIndividual(item.custo_unitario_calculado, s.unidades_por_embalagem);
        // Se informou quantas unidades individuais tem por embalagem, o produto
        // passa a ser cadastrado pela unidade individual (ex.: UN), não mais
        // pela unidade da nota (ex.: FD).
        const temEmbalagem = unidadesPorEmbalagemNum !== null && !isNaN(unidadesPorEmbalagemNum) && unidadesPorEmbalagemNum > 0;
        return {
          codigo_barras: item.codigo_barras,
          produto_id: item.produto_id,
          descricao: item.descricao,
          ncm: item.ncm,
          cest: item.cest,
          unidade: temEmbalagem ? (s.unidade_tributavel || item.unidade_tributavel || item.unidade) : item.unidade,
          preco_custo: custoUnit,
          preco_venda: s.preco_venda,
          // O backend ignora este campo hoje (CST da nota != FK do ERP) — mantido
          // só por compatibilidade, revise a situação tributária na tela de produto.
          situacao_tributaria: s.situacao_tributaria || null,
          unidade_tributavel: s.unidade_tributavel || null,
          unidades_por_embalagem: temEmbalagem ? unidadesPorEmbalagemNum : null,
        };
      });
    if (itens.length > 0) mutAplicar.mutate(itens);
  };

  const totalSel = Object.values(itensState).filter((s) => s.selecionado).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        titulo="NF-e de Compra"
        subtitulo="Importe a nota e precifique automaticamente"
        acoes={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Configurar certificado digital A1 para busca automática no SEFAZ">
              <IconButton onClick={() => setMostrarCert((v) => !v)} sx={{ color: tokens.color.textSecondary }}>
                <LockIcon />
              </IconButton>
            </Tooltip>
            {nfe && (
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={totalSel === 0 || mutAplicar.isPending}
                onClick={handleAplicar}
              >
                {mutAplicar.isPending ? 'Aplicando...' : `Aplicar ${totalSel} produto(s)`}
              </Button>
            )}
          </Box>
        }
      />

      {isLoading && <LinearProgress sx={{ flexShrink: 0 }} />}

      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2 }}>
        {mostrarCert && <PainelCertificado onFechar={() => setMostrarCert(false)} />}

        {!nfe ? (
          <>
            {/* Seletor de modo */}
            <Paper sx={{ borderRadius: tokens.radius.lg + 'px', overflow: 'hidden', maxWidth: 640, mx: 'auto', mt: 2 }}>
              <Tabs
                value={modoImport}
                onChange={(_, v) => setModoImport(v)}
                textColor="inherit"
                TabIndicatorProps={{ style: { backgroundColor: tokens.color.accent } }}
                sx={{ borderBottom: `1px solid ${tokens.color.border}`, bgcolor: tokens.color.bgSurface }}
              >
                <Tab value="barcode" icon={<QrCodeScannerIcon />} iconPosition="start" label="Bipar código de barras" />
                <Tab value="pdf" icon={<PictureAsPdfIcon />} iconPosition="start" label="Upload PDF" />
                <Tab value="xml" icon={<CodeIcon />} iconPosition="start" label="Upload XML" />
              </Tabs>

              <Box sx={{ p: 4, bgcolor: tokens.color.bgSurfaceRaised }}>
                {/* MODO: BARCODE */}
                {modoImport === 'barcode' && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Bipe o código de barras do DANFE impresso. O leitor vai digitar automaticamente
                      os 44 dígitos da chave de acesso.
                    </Typography>
                    <Box
                      sx={{
                        bgcolor: tokens.color.bgSurface,
                        border: `2px solid ${tokens.color.border}`,
                        borderRadius: tokens.radius.md + 'px',
                        p: 2,
                        '&:focus-within': {
                          borderColor: tokens.color.scan,
                          boxShadow: `0 0 0 4px ${tokens.color.scanMuted}`,
                        },
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: tokens.color.textTertiary, display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
                        Chave de acesso (44 dígitos)
                      </Typography>
                      <TextField
                        fullWidth
                        variant="standard"
                        placeholder="Bipe ou cole a chave aqui..."
                        value={chaveInput}
                        onChange={(e) => setChaveInput(e.target.value.replace(/\D/g, '').slice(0, 44))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && chaveInput.length === 44 && !mutChave.isPending)
                            mutChave.mutate(chaveInput);
                        }}
                        autoFocus
                        InputProps={{
                          disableUnderline: true,
                          style: { fontFamily: 'monospace', fontSize: 20, letterSpacing: 2 },
                        }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" sx={{ color: tokens.color.textTertiary }}>
                          {chaveInput.length}/44 dígitos
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={chaveInput.length !== 44 || mutChave.isPending}
                          onClick={() => mutChave.mutate(chaveInput)}
                        >
                          Buscar NF-e
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* MODO: PDF */}
                {modoImport === 'pdf' && (
                  <Box sx={{ textAlign: 'center' }}>
                    <PictureAsPdfIcon sx={{ fontSize: 48, color: tokens.color.accent, mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Selecione o PDF do DANFE. O sistema extrai a chave de acesso e busca
                      a NF-e no SEFAZ (requer certificado digital configurado).
                    </Typography>
                    <Button variant="contained" size="large" onClick={() => pdfInputRef.current?.click()}>
                      Selecionar PDF
                    </Button>
                    <input ref={pdfInputRef} type="file" accept=".pdf" hidden onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) mutPdf.mutate(f); e.target.value = '';
                    }} />
                  </Box>
                )}

                {/* MODO: XML */}
                {modoImport === 'xml' && (
                  <Box sx={{ textAlign: 'center' }}>
                    <CodeIcon sx={{ fontSize: 48, color: tokens.color.accent, mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Selecione o arquivo XML da NF-e. Esse é o método mais completo e confiável.
                    </Typography>
                    <Button variant="contained" size="large" onClick={() => xmlInputRef.current?.click()}>
                      Selecionar XML
                    </Button>
                    <input ref={xmlInputRef} type="file" accept=".xml" hidden onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) mutXml.mutate(f); e.target.value = '';
                    }} />
                  </Box>
                )}
              </Box>
            </Paper>

            {aviso && (
              <Box sx={{ maxWidth: 640, mx: 'auto', mt: 2 }}>
                <Alert
                  severity={aviso.tipo}
                  action={aviso.link ? (
                    <Button
                      size="small"
                      color="inherit"
                      endIcon={<OpenInNewIcon />}
                      onClick={() => window.open(aviso.link, '_blank')}
                    >
                      Abrir portal SEFAZ
                    </Button>
                  ) : undefined}
                >
                  {aviso.texto}
                </Alert>
              </Box>
            )}
          </>
        ) : (
          <>
            {/* Cabeçalho da NF-e */}
            <Paper sx={{ p: 2.5, mb: 2, borderRadius: tokens.radius.md + 'px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontFamily: tokens.font.display }}>
                  NF-e {nfe.numero ?? '—'}/{nfe.serie ?? '—'}
                </Typography>
                <Chip size="small" label={nfe.emitente_nome ?? '—'} sx={{ bgcolor: tokens.color.accentMuted, color: tokens.color.accent }} />
                {nfe.emitente_uf && <Chip size="small" label={nfe.emitente_uf} />}
                {nfe.data_emissao && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(nfe.data_emissao).toLocaleDateString('pt-BR')}
                  </Typography>
                )}
                <Button size="small" startIcon={<UploadFileIcon />} onClick={() => { setNfe(null); setItensState({}); setAviso(null); }} sx={{ ml: 'auto' }}>
                  Nova nota
                </Button>
              </Box>
              <Grid container spacing={1.5}>
                {([
                  ['Produtos', nfe.valor_produtos], ['Frete', nfe.valor_frete],
                  ['IPI', nfe.valor_ipi], ['ICMS', nfe.valor_icms],
                  ['ICMS-ST', nfe.valor_icms_st], ['PIS', nfe.valor_pis],
                  ['COFINS', nfe.valor_cofins], ['Desconto', -nfe.valor_desconto],
                  ['Total NF-e', nfe.valor_total],
                ] as [string, number][]).map(([label, val]) => (
                  <Grid item key={label}>
                    <Box sx={{ textAlign: 'center', px: 1.5, py: 0.75, bgcolor: tokens.color.bgSurfaceRaised, borderRadius: tokens.radius.sm + 'px' }}>
                      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: tokens.font.mono, color: label === 'Total NF-e' ? tokens.color.accent : undefined }}>
                        {BRL(val)}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            {/* Controles globais */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label="Margem global"
                size="small"
                value={margemGlobal}
                onChange={(e) => handleMargemGlobalChange(e.target.value)}
                sx={{ width: 150 }}
                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              />
              <Typography variant="caption" color="text.secondary">
                Aplica a todos. Edite individualmente na tabela.
              </Typography>
              <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<SelectAllIcon />} onClick={() => toggleTodos(true)}>Todos</Button>
                <Button size="small" startIcon={<DeselectIcon />} onClick={() => toggleTodos(false)}>Nenhum</Button>
              </Box>
            </Box>

            {/* Tabela */}
            <TableContainer component={Paper} sx={{ borderRadius: tokens.radius.md + 'px' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>#</TableCell>
                    <TableCell>EAN / Código</TableCell>
                    <TableCell>Descrição</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Qtd</TableCell>
                    <TableCell align="right">Custo Unit.</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                        Detalhe
                        <Tooltip title="IPI + Frete proporcional + ICMS-ST − Desconto adicionados ao custo unitário" arrow>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: tokens.color.textTertiary }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell align="right">Margem %</TableCell>
                    <TableCell align="right">Preço Venda</TableCell>
                    <TableCell>NCM</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Un. tributável
                        <Tooltip title="Unidade individual (ex.: UN), quando a unidade comercial da nota é uma caixa/pacote" arrow>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: tokens.color.textTertiary }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Un/embalagem
                        <Tooltip title="Vem calculado automaticamente quando a nota distingue unidade comercial de tributável. Quando aparecer em destaque (não veio na nota), preencha manualmente." arrow>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: tokens.color.textTertiary }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        Sit. Tributária
                        <Tooltip title="Não é aplicada automaticamente — o código da nota (CST/CSOSN) é diferente do código do seu ERP. Revise manualmente na tela de produto." arrow>
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: tokens.color.textTertiary }} />
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nfe.itens.map((item) => {
                    const s = itensState[item.numero_item];
                    if (!s) return null;
                    const expandido = expandidoIdx === item.numero_item;
                    return (
                      <Fragment key={item.numero_item}>
                        <TableRow key={item.numero_item} hover selected={s.selecionado}
                          onClick={() => setExpandidoIdx(expandido ? null : item.numero_item)}
                          sx={{ cursor: 'pointer' }}>
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox size="small" checked={s.selecionado}
                              onChange={(e) => setItemField(item.numero_item, 'selecionado', e.target.checked)} />
                          </TableCell>
                          <TableCell sx={{ color: tokens.color.textTertiary }}>{item.numero_item}</TableCell>
                          <TableCell sx={{ fontFamily: tokens.font.mono, fontSize: 11 }}>
                            {item.codigo_barras ?? item.codigo_fornecedor ?? '—'}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 180 }}>
                            <Typography variant="body2" noWrap>{item.descricao}</Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip size="small"
                              label={item.produto_cadastrado ? 'Cadastrado' : 'Novo'}
                              sx={{
                                bgcolor: item.produto_cadastrado ? tokens.color.statusValidoMuted : tokens.color.accentMuted,
                                color: item.produto_cadastrado ? tokens.color.statusValido : tokens.color.accent,
                                fontWeight: 700, fontSize: 10,
                              }} />
                            {item.produto_cadastrado && item.preco_atual !== null && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                atual: {BRL(item.preco_atual)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: tokens.font.mono }}>
                            {item.quantidade} {item.unidade}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: tokens.font.mono }}>
                            {BRL(item.valor_unitario)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" sx={{ color: tokens.color.textTertiary, fontFamily: tokens.font.mono, display: 'block' }}>
                              +IPI {BRL(item.imposto.valor_ipi / Math.max(item.quantidade, 1))}
                            </Typography>
                            <Typography variant="caption" sx={{ color: tokens.color.textTertiary, fontFamily: tokens.font.mono, display: 'block' }}>
                              +Frete {BRL(item.valor_frete_item / Math.max(item.quantidade, 1))}
                            </Typography>
                            {item.imposto.valor_icms_st > 0 && (
                              <Typography variant="caption" sx={{ color: tokens.color.statusNaoEncontrado, fontFamily: tokens.font.mono, display: 'block' }}>
                                +ST {BRL(item.imposto.valor_icms_st / Math.max(item.quantidade, 1))}
                              </Typography>
                            )}
                            <Divider sx={{ my: 0.25, borderColor: tokens.color.border }} />
                            <Typography variant="caption" sx={{ fontFamily: tokens.font.mono, display: 'block' }}>
                              = {BRL(item.custo_unitario_calculado)} / {item.unidade ?? 'un. da nota'}
                            </Typography>
                            {s.unidades_por_embalagem && parseFloat(s.unidades_por_embalagem.replace(',', '.')) > 0 && (
                              <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: tokens.font.mono, display: 'block', color: tokens.color.accent }}>
                                ÷ {s.unidades_por_embalagem} = {BRL(custoPorUnidadeIndividual(item.custo_unitario_calculado, s.unidades_por_embalagem))} / un.
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <TextField size="small" value={s.margem}
                              onChange={(e) => setItemField(item.numero_item, 'margem', parseFloat(e.target.value) || 0)}
                              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                              sx={{ width: 90 }}
                              inputProps={{ style: { textAlign: 'right', fontFamily: 'monospace' } }} />
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <TextField size="small" value={s.preco_venda}
                              onChange={(e) => setItemField(item.numero_item, 'preco_venda', parseFloat(e.target.value) || 0)}
                              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                              sx={{ width: 110 }}
                              inputProps={{ style: { textAlign: 'right', fontFamily: 'monospace' } }} />
                          </TableCell>
                         <TableCell sx={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                            {item.ncm ?? '—'}
                            {item.cest && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                CEST {item.cest}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <TextField size="small" value={s.unidade_tributavel}
                              onChange={(e) => setItemField(item.numero_item, 'unidade_tributavel', e.target.value)}
                              placeholder="UN" sx={{ width: 80 }} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <TextField size="small" value={s.unidades_por_embalagem}
                              onChange={(e) => setItemField(item.numero_item, 'unidades_por_embalagem', e.target.value)}
                              placeholder={item.unidades_por_embalagem === null ? 'não veio na nota' : 'ex.: 12'}
                              sx={{
                                width: 110,
                                ...(item.unidades_por_embalagem === null && !s.unidades_por_embalagem
                                  ? { '& .MuiOutlinedInput-root': { bgcolor: tokens.color.statusNaoEncontradoMuted } }
                                  : {}),
                              }} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <TextField size="small" value={s.situacao_tributaria}
                              onChange={(e) => setItemField(item.numero_item, 'situacao_tributaria', e.target.value)}
                              placeholder="CST/CSOSN" sx={{ width: 110 }} />
                          </TableCell>
                        </TableRow>
                        {expandido && (
                          <TableRow key={`d${item.numero_item}`} sx={{ bgcolor: tokens.color.bgSurfaceRaised }}>
                            <TableCell colSpan={15} sx={{ py: 1.5 }}>
                              <Grid container spacing={2} sx={{ px: 1 }}>
                                {([
                                  ['Total item', BRL(item.valor_total_item)],
                                  ['Desconto', BRL(item.valor_desconto_item)],
                                  ['Frete prop.', BRL(item.valor_frete_item)],
                                  ['IPI', `${PCT(item.imposto.perc_ipi)} = ${BRL(item.imposto.valor_ipi)}`],
                                  ['ICMS', `${PCT(item.imposto.perc_icms)} = ${BRL(item.imposto.valor_icms)}`],
                                  ['ICMS-ST', `${PCT(item.imposto.perc_icms_st)} = ${BRL(item.imposto.valor_icms_st)}`],
                                  ['PIS', `${PCT(item.imposto.perc_pis)} = ${BRL(item.imposto.valor_pis)}`],
                                  ['COFINS', `${PCT(item.imposto.perc_cofins)} = ${BRL(item.imposto.valor_cofins)}`],
                                  ['CFOP', item.cfop ?? '—'],
                                  ['Origem ICMS', item.imposto.orig_icms ?? '—'],
                                  ['Cód. fornecedor', item.codigo_fornecedor ?? '—'],
                                  ['Qtd. tributável (nota)', `${item.quantidade_tributavel} ${item.unidade_tributavel ?? ''}`],
                                ] as [string, string][]).map(([l, v]) => (
                                  <Grid item key={l}>
                                    <Typography variant="caption" color="text.secondary" display="block">{l}</Typography>
                                    <Typography variant="body2" sx={{ fontFamily: tokens.font.mono, fontWeight: 600 }}>{v}</Typography>
                                  </Grid>
                                ))}
                              </Grid>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>

      <Snackbar open={!!aviso && !!nfe} autoHideDuration={4000} onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {(aviso && nfe) ? <Alert severity={aviso.tipo} variant="filled">{aviso.texto}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}