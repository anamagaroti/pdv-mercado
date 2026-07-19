import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Alert,
  LinearProgress,
  Divider,
  Tooltip,
  Paper,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ncmApi, GrupoNcmProblematico, CorrecaoNcm } from '../../api';
import { tokens } from '../../theme/tokens';

interface Selecao {
  ncm_novo: string;
  produto_ids: number[];
  auto: boolean; // true = pré-selecionado automaticamente, false = escolhido manualmente
}

interface SelecoesMap {
  [ncmAtual: string]: Selecao | null; // null = ignorado
}

/** Retorna o código NCM da melhor sugestão já rankeada pelo backend. */
function melhorSugestao(grupo: GrupoNcmProblematico): string | null {
  const idx = grupo.melhor_indice ?? 0;
  const sugestao = grupo.sugestoes[idx];
  return sugestao?.ativo ? sugestao.codigo : (grupo.sugestoes.find((s) => s.ativo)?.codigo ?? null);
}

/** Monta o estado inicial de seleções já com a melhor sugestão pré-selecionada para cada grupo. */
function buildSelecoesPadrao(grupos: GrupoNcmProblematico[]): SelecoesMap {
  const mapa: SelecoesMap = {};
  for (const grupo of grupos) {
    const chave = grupo.ncm_atual ?? '__sem_ncm__';
    const melhor = melhorSugestao(grupo);
    mapa[chave] = melhor
      ? {
          ncm_novo: melhor,
          produto_ids: grupo.produtos_afetados.map((p) => p.produto_id),
          auto: true,
        }
      : null; // sem sugestão ativa → deixa como "ignorar" até o usuário preencher
  }
  return mapa;
}

export default function PainelCorrecaoNcm({
  onCorrecaoAplicada,
}: {
  onCorrecaoAplicada: () => void;
}) {
  const [selecoes, setSelecoes] = useState<SelecoesMap>({});
  const [expandido, setExpandido] = useState<string | false>(false);
  const queryClient = useQueryClient();

  const { data: grupos, isLoading, isError, error } = useQuery({
    queryKey: ['ncm-problematicos'],
    queryFn: ncmApi.analisarProblematicos,
    staleTime: Infinity,
  });

  // Assim que os grupos chegam, pré-seleciona automaticamente a melhor sugestão de cada um.
  useEffect(() => {
    if (grupos && grupos.length > 0) {
      setSelecoes(buildSelecoesPadrao(grupos));
    }
  }, [grupos]);

  const mutationAplicar = useMutation({
    mutationFn: (correcoes: CorrecaoNcm[]) => ncmApi.aplicarCorrecoes(correcoes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ultima-validacao-ncm'] });
      queryClient.invalidateQueries({ queryKey: ['ncm-problematicos'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onCorrecaoAplicada();
    },
  });

  const handleSelecionarNcm = (chave: string, ncmNovo: string, produtoIds: number[]) => {
    setSelecoes((prev) => ({
      ...prev,
      [chave]: { ncm_novo: ncmNovo, produto_ids: produtoIds, auto: false },
    }));
  };

  const handleIgnorar = (chave: string) => {
    setSelecoes((prev) => ({ ...prev, [chave]: null }));
  };

  const handleAplicar = () => {
    const correcoes: CorrecaoNcm[] = Object.values(selecoes)
      .filter((s): s is NonNullable<typeof s> => s !== null && s !== undefined)
      .filter((s) => s.ncm_novo.replace(/\D/g, '').length === 8);
    if (correcoes.length === 0) return;
    mutationAplicar.mutate(correcoes);
  };

  // Métricas do rodapé de ação
  const totalComSelecao = Object.values(selecoes).filter(
    (s) => s !== null && s !== undefined && s.ncm_novo.replace(/\D/g, '').length === 8
  ).length;
  const totalAuto = Object.values(selecoes).filter(
    (s) => s !== null && s !== undefined && (s as Selecao).auto
  ).length;
  const totalSemSugestao = grupos
    ? grupos.filter((g) => !melhorSugestao(g)).length
    : 0;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Consultando o Siscomex para cada NCM problemático — buscando a melhor sugestão para
          cada produto...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        Não foi possível conectar ao Siscomex:{' '}
        {(error as any)?.response?.data?.mensagem ?? 'verifique sua conexão e tente novamente.'}
      </Alert>
    );
  }

  if (!grupos || grupos.length === 0) {
    return (
      <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1 }}>
        Nenhum NCM inválido ou não encontrado — nada a corrigir.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Banner de resumo das pré-seleções automáticas */}
      <Paper
        sx={{
          p: 2,
          mb: 2.5,
          borderRadius: tokens.radius.md + 'px',
          bgcolor: tokens.color.accentMuted,
          border: `1px solid ${tokens.color.accent}40`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <AutoFixHighIcon sx={{ color: tokens.color.accent, fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textPrimary }}>
            {totalAuto} de {grupos.length} NCMs foram pré-selecionados automaticamente com a
            melhor sugestão do Siscomex.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Revise os acordeões abaixo, ajuste o que achar necessário e clique em "Aplicar
            correções".
            {totalSemSugestao > 0 &&
              ` ${totalSemSugestao} NCM${totalSemSugestao > 1 ? 's' : ''} não tiveram sugestão automática — preencha manualmente.`}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AutoFixHighIcon />}
          disabled={totalComSelecao === 0 || mutationAplicar.isPending}
          onClick={handleAplicar}
          sx={{ flexShrink: 0 }}
        >
          {mutationAplicar.isPending
            ? 'Aplicando...'
            : `Aplicar ${totalComSelecao} correção${totalComSelecao !== 1 ? 'ões' : ''}`}
        </Button>
      </Paper>

      {mutationAplicar.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {mutationAplicar.data.total_corrigidos} produto
          {mutationAplicar.data.total_corrigidos !== 1 ? 's' : ''} corrigido
          {mutationAplicar.data.total_corrigidos !== 1 ? 's' : ''} com sucesso.
        </Alert>
      )}

      {grupos.map((grupo) => {
        const chave = grupo.ncm_atual ?? '__sem_ncm__';
        const selecaoAtual = selecoes[chave];
        const ignorado = selecaoAtual === null;
        const temSelecao =
          selecaoAtual !== null &&
          selecaoAtual !== undefined &&
          selecaoAtual.ncm_novo.replace(/\D/g, '').length === 8;
        const foiAutoSelecionado = temSelecao && (selecaoAtual as Selecao).auto;
        const semSugestoes = grupo.sugestoes.filter((s) => s.ativo).length === 0;

        return (
          <Accordion
            key={chave}
            expanded={expandido === chave}
            onChange={(_, aberto) => setExpandido(aberto ? chave : false)}
            sx={{
              mb: 1,
              bgcolor: tokens.color.bgSurfaceRaised,
              border: `1px solid ${
                temSelecao
                  ? foiAutoSelecionado
                    ? tokens.color.accent + '50'
                    : tokens.color.statusValido + '60'
                  : ignorado
                  ? tokens.color.border
                  : grupo.status === 'invalido'
                  ? tokens.color.statusInvalido + '40'
                  : tokens.color.statusNaoEncontrado + '40'
              }`,
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flexWrap: 'wrap',
                  mr: 1,
                }}
              >
                {/* Status original */}
                <Chip
                  size="small"
                  label={grupo.status === 'invalido' ? '🔴 Inválido' : '🟡 Não encontrado'}
                  sx={{
                    bgcolor:
                      grupo.status === 'invalido'
                        ? tokens.color.statusInvalidoMuted
                        : tokens.color.statusNaoEncontradoMuted,
                    color:
                      grupo.status === 'invalido'
                        ? tokens.color.statusInvalido
                        : tokens.color.statusNaoEncontrado,
                    fontWeight: 700,
                  }}
                />

                {/* NCM atual */}
                <Typography
                  variant="body2"
                  sx={{ fontFamily: tokens.font.mono, fontWeight: 600 }}
                >
                  {grupo.ncm_atual ?? '(sem NCM)'}
                </Typography>

                {/* Descrição do NCM antigo (se houver) */}
                {grupo.descricao_ncm_antigo && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ maxWidth: 260 }}
                  >
                    {grupo.descricao_ncm_antigo}
                  </Typography>
                )}

                {/* Qtd de produtos */}
                <Chip
                  size="small"
                  label={`${grupo.produtos_afetados.length} produto${grupo.produtos_afetados.length !== 1 ? 's' : ''}`}
                  sx={{ bgcolor: tokens.color.accentMuted, color: tokens.color.accent }}
                />

                {/* Badge da seleção atual */}
                {temSelecao && (
                  <Tooltip
                    title={
                      foiAutoSelecionado
                        ? 'Pré-selecionado automaticamente — clique para revisar'
                        : 'Selecionado manualmente'
                    }
                  >
                    <Chip
                      size="small"
                      icon={
                        foiAutoSelecionado ? (
                          <AutoFixHighIcon sx={{ fontSize: '13px !important' }} />
                        ) : (
                          <CheckCircleIcon sx={{ fontSize: '13px !important' }} />
                        )
                      }
                      label={`→ ${selecaoAtual!.ncm_novo}`}
                      sx={{
                        bgcolor: foiAutoSelecionado
                          ? tokens.color.accentMuted
                          : tokens.color.statusValidoMuted,
                        color: foiAutoSelecionado
                          ? tokens.color.accent
                          : tokens.color.statusValido,
                        fontFamily: tokens.font.mono,
                        fontWeight: 700,
                        '& .MuiChip-icon': {
                          color: foiAutoSelecionado
                            ? tokens.color.accent
                            : tokens.color.statusValido,
                        },
                      }}
                    />
                  </Tooltip>
                )}

                {semSugestoes && !ignorado && (
                  <Chip
                    size="small"
                    label="⚠ Preencha manualmente"
                    sx={{
                      bgcolor: tokens.color.statusInvalidoMuted,
                      color: tokens.color.statusInvalido,
                      fontWeight: 600,
                    }}
                  />
                )}

                {ignorado && (
                  <Chip
                    size="small"
                    icon={<SkipNextIcon sx={{ fontSize: '13px !important' }} />}
                    label="Ignorado"
                    sx={{
                      bgcolor: tokens.color.border,
                      color: tokens.color.textTertiary,
                      '& .MuiChip-icon': { color: tokens.color.textTertiary },
                    }}
                  />
                )}
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ pt: 0 }}>
              {/* Lista de produtos afetados */}
              <Typography
                variant="caption"
                sx={{
                  color: tokens.color.textTertiary,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Produtos afetados
              </Typography>
              <Box sx={{ mt: 0.5, mb: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {grupo.produtos_afetados.slice(0, 5).map((p) => (
                  <Typography key={p.produto_id} variant="body2" noWrap>
                    <span
                      style={{
                        color: tokens.color.textTertiary,
                        fontFamily: 'monospace',
                        fontSize: 11,
                        marginRight: 8,
                      }}
                    >
                      {p.codigo_barras ?? `#${p.produto_id}`}
                    </span>
                    {p.descricao}
                  </Typography>
                ))}
                {grupo.produtos_afetados.length > 5 && (
                  <Typography variant="caption" color="text.secondary">
                    + {grupo.produtos_afetados.length - 5} outros produtos com este NCM
                  </Typography>
                )}
              </Box>

              <Divider sx={{ borderColor: tokens.color.border, mb: 2 }} />

              {/* Sugestões */}
              <Typography
                variant="caption"
                sx={{
                  color: tokens.color.textTertiary,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Sugestões do Siscomex
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {grupo.texto_busca}
              </Typography>

              {grupo.sugestoes.length > 0 ? (
                <RadioGroup
                  value={selecaoAtual?.ncm_novo ?? ''}
                  onChange={(e) =>
                    handleSelecionarNcm(
                      chave,
                      e.target.value,
                      grupo.produtos_afetados.map((p) => p.produto_id)
                    )
                  }
                  sx={{ mt: 0.5 }}
                >
                  {grupo.sugestoes.map((s) => (
                    <FormControlLabel
                      key={s.codigo}
                      value={s.codigo}
                      control={<Radio size="small" />}
                      label={
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1.5,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            py: 0.25,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: tokens.font.mono,
                              fontWeight: 700,
                              color: tokens.color.accent,
                            }}
                          >
                            {s.codigo}
                          </Typography>
                          <Typography variant="body2">{s.descricao}</Typography>
                          <Chip
                            size="small"
                            label={{
                              mesma_subposicao: 'Mesma subposição',
                              mesma_posicao: 'Mesma posição',
                              mesmo_capitulo: 'Mesmo capítulo',
                              busca_texto: 'Por descrição',
                            }[s.origem]}
                            sx={{
                              bgcolor: tokens.color.accentMuted,
                              color: tokens.color.accent,
                              fontSize: 10,
                              height: 18,
                              fontWeight: 600,
                            }}
                          />
                          {s.ativo ? (
                            <Chip
                              size="small"
                              label="Vigente"
                              sx={{
                                bgcolor: tokens.color.statusValidoMuted,
                                color: tokens.color.statusValido,
                                fontSize: 10,
                                height: 18,
                              }}
                            />
                          ) : (
                            <Tooltip title={`Data fim: ${s.data_fim}`}>
                              <Chip
                                size="small"
                                icon={
                                  <WarningAmberIcon sx={{ fontSize: '12px !important' }} />
                                }
                                label="Expirado"
                                sx={{
                                  bgcolor: tokens.color.statusInvalidoMuted,
                                  color: tokens.color.statusInvalido,
                                  fontSize: 10,
                                  '& .MuiChip-icon': { color: tokens.color.statusInvalido },
                                }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', mb: 0.25 }}
                    />
                  ))}
                </RadioGroup>
              ) : (
                <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
                  Nenhuma sugestão encontrada automaticamente para &quot;{grupo.texto_busca}&quot;.
                  Use o campo abaixo para inserir o NCM correto manualmente.
                </Alert>
              )}

              {/* Campo manual */}
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 1.5 }}>
                <TextField
                  size="small"
                  label="Ou informe o NCM manualmente"
                  placeholder="Ex: 17019900"
                  inputProps={{ maxLength: 10 }}
                  value={
                    selecaoAtual !== null &&
                    selecaoAtual !== undefined &&
                    !grupo.sugestoes.find((s) => s.codigo === selecaoAtual?.ncm_novo)
                      ? selecaoAtual.ncm_novo
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val) {
                      handleSelecionarNcm(
                        chave,
                        val,
                        grupo.produtos_afetados.map((p) => p.produto_id)
                      );
                    }
                  }}
                  sx={{ width: 220 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => handleIgnorar(chave)}
                  sx={{ color: tokens.color.textTertiary }}
                >
                  Ignorar este NCM
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}