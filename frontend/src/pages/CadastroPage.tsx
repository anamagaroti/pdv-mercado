import { useState } from 'react';
import { Box, Typography, Snackbar, Alert } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/layout/PageHeader';
import ScanField from '../components/cadastro/ScanField';
import ProdutoExistenteForm from '../components/cadastro/ProdutoExistenteForm';
import NovoProdutoForm from '../components/cadastro/NovoProdutoForm';
import { produtosApi, Produto } from '../api';
import { tokens } from '../theme/tokens';

type EstadoTela =
  | { tipo: 'aguardando' }
  | { tipo: 'produto_existente'; produto: Produto }
  | { tipo: 'produto_novo'; codigoBarras: string };

export default function CadastroPage() {
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [estado, setEstado] = useState<EstadoTela>({ tipo: 'aguardando' });
  const [carregandoBusca, setCarregandoBusca] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const queryClient = useQueryClient();

  const handleBuscarCodigo = async (codigo: string) => {
    setCarregandoBusca(true);
    try {
      const resultado = await produtosApi.buscarPorCodigoBarras(codigo);
      if (resultado.encontrado && resultado.produto) {
        setEstado({ tipo: 'produto_existente', produto: resultado.produto });
      } else {
        setEstado({ tipo: 'produto_novo', codigoBarras: codigo });
      }
    } catch {
      setAviso({ tipo: 'error', texto: 'Erro ao buscar produto. Tente novamente.' });
    } finally {
      setCarregandoBusca(false);
    }
  };

  const resetarParaProximaLeitura = () => {
    setCodigoDigitado('');
    setEstado({ tipo: 'aguardando' });
  };

  const mutationAtualizar = useMutation({
    mutationFn: ({ id, dados }: { id: number; dados: Partial<Produto> }) =>
      produtosApi.atualizar(id, dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAviso({ tipo: 'success', texto: 'Produto atualizado com sucesso.' });
      resetarParaProximaLeitura();
    },
    onError: () => setAviso({ tipo: 'error', texto: 'Erro ao salvar alterações.' }),
  });

  const mutationCriar = useMutation({
    mutationFn: (dados: Partial<Produto>) => produtosApi.criar(dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAviso({ tipo: 'success', texto: 'Produto cadastrado com sucesso.' });
      resetarParaProximaLeitura();
    },
    onError: () => setAviso({ tipo: 'error', texto: 'Erro ao cadastrar produto.' }),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        titulo="Cadastro e conferência"
        subtitulo="Bipe o código de barras para iniciar"
      />

      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 3, maxWidth: 920, width: '100%', mx: 'auto' }}>
        <ScanField
          valor={codigoDigitado}
          onChange={setCodigoDigitado}
          onSubmit={handleBuscarCodigo}
          carregando={carregandoBusca}
          disabled={estado.tipo !== 'aguardando'}
        />

        {estado.tipo === 'aguardando' && (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="body2" sx={{ color: tokens.color.textTertiary }}>
              Aguardando leitura do código de barras...
            </Typography>
          </Box>
        )}

        {estado.tipo === 'produto_existente' && (
          <Box sx={{ mt: 3 }}>
            <ProdutoExistenteForm
              produto={estado.produto}
              salvando={mutationAtualizar.isPending}
              onSalvar={(dados) =>
                mutationAtualizar.mutate({ id: (estado as any).produto.id, dados })
              }
              onCancelar={resetarParaProximaLeitura}
            />
          </Box>
        )}

        {estado.tipo === 'produto_novo' && (
          <Box sx={{ mt: 3 }}>
            <NovoProdutoForm
              codigoBarras={estado.codigoBarras}
              salvando={mutationCriar.isPending}
              onSalvar={(dados) => mutationCriar.mutate(dados)}
              onCancelar={resetarParaProximaLeitura}
            />
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!aviso}
        autoHideDuration={3500}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {aviso ? (
          <Alert severity={aviso.tipo} variant="filled" sx={{ width: '100%' }}>
            {aviso.texto}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
