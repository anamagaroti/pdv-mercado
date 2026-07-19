import { useState } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Stack } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tabelasPrecosApi, PrecoProduto } from '../../api';
import { tokens } from '../../theme/tokens';

interface Props {
  produtoId: number;
}

/**
 * Nesse ERP não existe um campo único "preço de custo" — cada produto pode
 * ter um valor diferente por TABELAPRECOS (ex.: Varejo, Atacado, Custo...).
 * Esse componente lista todas as tabelas existentes e deixa editar o valor
 * do produto em cada uma, sem assumir qual delas é "o custo".
 */
export default function TabelasPrecoProduto({ produtoId }: Props) {
  const queryClient = useQueryClient();
  const [valoresEditados, setValoresEditados] = useState<Record<number, string>>({});

  const { data: precos = [], isLoading } = useQuery({
    queryKey: ['precos-produto', produtoId],
    queryFn: () => tabelasPrecosApi.precosDoProduto(produtoId),
  });

  const mutation = useMutation({
    mutationFn: ({ tabelaPrecoId, valorVenda }: { tabelaPrecoId: number; valorVenda: number }) =>
      tabelasPrecosApi.definirPreco(produtoId, tabelaPrecoId, valorVenda),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precos-produto', produtoId] });
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">
          Carregando tabelas de preço...
        </Typography>
      </Box>
    );
  }

  const handleSalvar = (item: PrecoProduto) => {
    const bruto = valoresEditados[item.tabelaPrecoId] ?? item.valorVenda?.toString() ?? '';
    const valor = parseFloat(bruto.replace(',', '.'));
    if (isNaN(valor)) return;
    mutation.mutate({ tabelaPrecoId: item.tabelaPrecoId, valorVenda: valor });
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, color: tokens.color.textTertiary }}>
        Preços por tabela
      </Typography>
      <Stack spacing={1}>
        {precos.map((item) => (
          <Box key={item.tabelaPrecoId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 160 }}>
              {item.nomeTabela}
            </Typography>
            <TextField
              size="small"
              value={valoresEditados[item.tabelaPrecoId] ?? item.valorVenda?.toString() ?? ''}
              onChange={(e) =>
                setValoresEditados((atual) => ({ ...atual, [item.tabelaPrecoId]: e.target.value }))
              }
              placeholder="0,00"
            />
            <IconButton size="small" onClick={() => handleSalvar(item)} disabled={mutation.isPending}>
              <SaveIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        {precos.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Nenhuma tabela de preço cadastrada no sistema.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
