import { useState, useRef } from 'react';
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
  MenuItem,
  Select,
  Alert,
  Chip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useMutation } from '@tanstack/react-query';
import PageHeader from '../components/layout/PageHeader';
import { importacaoApi, PreviaImportacao, ResultadoImportacao } from '../api';
import { tokens } from '../theme/tokens';

const CAMPOS_SISTEMA = [
  { valor: '', label: '— Ignorar coluna —' },
  { valor: 'codigo_barras', label: 'Código de barras' },
  { valor: 'descricao', label: 'Descrição' },
  { valor: 'preco', label: 'Preço' },
  { valor: 'preco_custo', label: 'Preço de custo' },
  { valor: 'ncm', label: 'NCM' },
  { valor: 'grupo', label: 'Grupo' },
  { valor: 'situacao_tributaria', label: 'Situação tributária' },
];

export default function ImportacaoPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [mapeamento, setMapeamento] = useState<Record<string, string | null>>({});
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutationPrevia = useMutation({
    mutationFn: (arq: File) => importacaoApi.previa(arq),
    onSuccess: (data) => {
      setPrevia(data);
      setMapeamento(data.mapeamentoSugerido);
      setResultado(null);
    },
  });

  const mutationImportar = useMutation({
    mutationFn: () => importacaoApi.importar(arquivo!, mapeamento),
    onSuccess: (data) => setResultado(data),
  });

  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    setResultado(null);
    mutationPrevia.mutate(f);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        titulo="Importação"
        subtitulo="Importe a planilha Excel uma vez — os dados passam a viver no sistema"
      />

      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 3, maxWidth: 920, width: '100%', mx: 'auto' }}>
        <Paper
          sx={{
            p: 4,
            borderRadius: tokens.radius.lg + 'px',
            bgcolor: tokens.color.bgSurfaceRaised,
            border: `1px dashed ${tokens.color.borderStrong}`,
            textAlign: 'center',
          }}
        >
          <UploadFileIcon sx={{ fontSize: 36, color: tokens.color.accent, mb: 1 }} />
          <Typography sx={{ mb: 2 }}>
            {arquivo ? arquivo.name : 'Selecione a planilha (.xlsx) para importar'}
          </Typography>
          <Button variant="contained" onClick={() => inputRef.current?.click()}>
            Escolher arquivo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={handleSelecionarArquivo}
          />
        </Paper>

        {mutationPrevia.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Não foi possível ler a planilha. Verifique se é um arquivo .xlsx válido.
          </Alert>
        )}

        {previa && (
          <Paper sx={{ mt: 3, p: 3, borderRadius: tokens.radius.lg + 'px' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
              Mapeamento de colunas
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {previa.totalLinhas.toLocaleString('pt-BR')} linhas detectadas. Ajuste o
              mapeamento abaixo se alguma coluna não foi reconhecida automaticamente.
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Coluna da planilha</TableCell>
                  <TableCell>Campo do sistema</TableCell>
                  <TableCell>Amostra</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previa.colunas.map((coluna) => (
                  <TableRow key={coluna}>
                    <TableCell sx={{ fontWeight: 500 }}>{coluna}</TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={mapeamento[coluna] ?? ''}
                        onChange={(e) =>
                          setMapeamento((m) => ({
                            ...m,
                            [coluna]: e.target.value || null,
                          }))
                        }
                        sx={{ minWidth: 200 }}
                      >
                        {CAMPOS_SISTEMA.map((c) => (
                          <MenuItem key={c.valor} value={c.valor}>
                            {c.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell sx={{ color: tokens.color.textTertiary, fontSize: 12 }}>
                      {String(previa.linhasAmostra[0]?.[coluna] ?? '—')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                onClick={() => mutationImportar.mutate()}
                disabled={mutationImportar.isPending}
              >
                {mutationImportar.isPending ? 'Importando...' : 'Confirmar importação'}
              </Button>
            </Box>
          </Paper>
        )}

        {resultado && (
          <Alert severity={resultado.total_erros > 0 ? 'warning' : 'success'} sx={{ mt: 3 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Importação concluída</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <Chip size="small" label={`${resultado.total_linhas} linhas processadas`} />
              <Chip
                size="small"
                label={`${resultado.total_novos} novos`}
                sx={{ bgcolor: tokens.color.statusValidoMuted, color: tokens.color.statusValido }}
              />
              <Chip
                size="small"
                label={`${resultado.total_atualizados} atualizados`}
                sx={{ bgcolor: tokens.color.accentMuted, color: tokens.color.accent }}
              />
              {resultado.total_erros > 0 && (
                <Chip
                  size="small"
                  label={`${resultado.total_erros} erros`}
                  sx={{ bgcolor: tokens.color.statusInvalidoMuted, color: tokens.color.statusInvalido }}
                />
              )}
            </Box>
          </Alert>
        )}
      </Box>
    </Box>
  );
}
