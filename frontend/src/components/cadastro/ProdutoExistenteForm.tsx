import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box, Paper, TextField, MenuItem, Typography, Button, Grid, Chip, Switch, FormControlLabel, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { useQuery } from '@tanstack/react-query';
import { Produto, listasApoioApi } from '../../api';
import { tokens } from '../../theme/tokens';
import TabelasPrecoProduto from './TabelasPrecoProduto';

interface Props {
  produto: Produto;
  salvando: boolean;
  onSalvar: (dados: Partial<Produto>) => void;
  onCancelar: () => void;
}

interface FormValues {
  descricao: string;
  preco: string;
  ncm: string;
  situacao_tributaria: string;
  grupo_imposto: string;
  grupo_pis_cofins: string;
  unidade: string;
  cest: string;
  origem: string;
  ativo: boolean;
}

export default function ProdutoExistenteForm({ produto, salvando, onSalvar, onCancelar }: Props) {
  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      descricao: produto.descricao,
      preco: produto.preco?.toString() ?? '',
      ncm: produto.ncm ?? '',
      situacao_tributaria: produto.situacao_tributaria ?? '',
      grupo_imposto: produto.grupo_imposto?.toString() ?? '',
      grupo_pis_cofins: produto.grupo_pis_cofins?.toString() ?? '',
      unidade: produto.unidade ?? '',
      cest: produto.cest ?? '',
      origem: produto.origem ?? '',
      ativo: produto.ativo ?? true,
    },
  });

  useEffect(() => {
    reset({
      descricao: produto.descricao,
      preco: produto.preco?.toString() ?? '',
      ncm: produto.ncm ?? '',
      situacao_tributaria: produto.situacao_tributaria ?? '',
      grupo_imposto: produto.grupo_imposto?.toString() ?? '',
      grupo_pis_cofins: produto.grupo_pis_cofins?.toString() ?? '',
      unidade: produto.unidade ?? '',
      cest: produto.cest ?? '',
      origem: produto.origem ?? '',
      ativo: produto.ativo ?? true,
    });
  }, [produto, reset]);

  const ativo = watch('ativo');

  // Listas de apoio: valores válidos das FKs (evita erro de violação de FK no Firebird)
  const { data: situacoesTributarias = [] } = useQuery({
    queryKey: ['situacoes-tributarias'],
    queryFn: listasApoioApi.situacoesTributarias,
    staleTime: 5 * 60_000,
  });
  const { data: gruposImposto = [] } = useQuery({
    queryKey: ['grupos-imposto'],
    queryFn: listasApoioApi.gruposImposto,
    staleTime: 5 * 60_000,
  });
  const { data: gruposPisCofins = [] } = useQuery({
    queryKey: ['grupos-pis-cofins'],
    queryFn: listasApoioApi.gruposPisCofins,
    staleTime: 5 * 60_000,
  });

  const onSubmit = (v: FormValues) => {
    onSalvar({
      descricao: v.descricao,
      preco: v.preco ? parseFloat(v.preco.replace(',', '.')) : undefined,
      ncm: v.ncm || undefined,
      situacao_tributaria: v.situacao_tributaria || undefined,
      grupo_imposto: v.grupo_imposto ? Number(v.grupo_imposto) : undefined,
      grupo_pis_cofins: v.grupo_pis_cofins ? Number(v.grupo_pis_cofins) : undefined,
      unidade: v.unidade || undefined,
      cest: v.cest || undefined,
      origem: v.origem || undefined,
      ativo: v.ativo,
    });
  };

  return (
    <Paper sx={{ p: 3, borderRadius: tokens.radius.lg + 'px', bgcolor: tokens.color.bgSurface }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Chip
          size="small"
          label="Produto encontrado"
          sx={{ bgcolor: tokens.color.statusValidoMuted, color: tokens.color.statusValido, fontWeight: 600 }}
        />
        <Typography variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.textTertiary }}>
          {produto.codigo_barras}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={ativo}
              onChange={(e) => setValue('ativo', e.target.checked)}
            />
          }
          label={<Typography variant="caption">{ativo ? 'Ativo' : 'Inativo'}</Typography>}
          sx={{ ml: 'auto' }}
        />
      </Box>

      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField label="Descrição" fullWidth {...register('descricao', { required: true })} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Preço de venda" fullWidth {...register('preco')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="NCM" fullWidth {...register('ncm')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Unidade" fullWidth {...register('unidade')} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="CEST" fullWidth {...register('cest')} />
          </Grid>

          <Grid item xs={6} sm={4}>
            <TextField label="Situação tributária" select fullWidth {...register('situacao_tributaria')}>
              <MenuItem value="">— nenhuma —</MenuItem>
              {situacoesTributarias.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.id} — {o.descricao}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField label="Grupo de imposto" select fullWidth {...register('grupo_imposto')}>
              <MenuItem value="">— nenhum —</MenuItem>
              {gruposImposto.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.descricao}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField label="Grupo PIS/COFINS" select fullWidth {...register('grupo_pis_cofins')}>
              <MenuItem value="">— nenhum —</MenuItem>
              {gruposPisCofins.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.descricao}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Origem" fullWidth {...register('origem')} />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
          <Button onClick={onCancelar} disabled={salvando}>Cancelar</Button>
          <Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </Box>
      </Box>

      <Divider sx={{ my: 2, borderColor: tokens.color.border }} />

      {/* Preço de custo e outras tabelas de preço vivem em TABELAPRECOSPRODUTOS,
          não em PRODUTOS — por isso são editados separadamente aqui. */}
      <TabelasPrecoProduto produtoId={produto.id} />
    </Paper>
  );
}