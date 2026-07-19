import Fuse from 'fuse.js';
import { Produto, SugestaoSimilar } from '../../types/produto';
import * as produtosService from '../produtos/produtos.service';
import {
  normalizarTexto,
  tokenizar,
  removerMarcasConhecidas,
  similaridadeJaccard,
} from './texto.utils';

/**
 * O conceito de "marca" não existe mais no Produto (não existe coluna
 * equivalente em PRODUTOS no Firebird), então não há mais como carregar uma
 * lista de marcas conhecidas do banco. Mantemos a chamada a
 * removerMarcasConhecidas com lista vazia (vira passthrough) só para não
 * precisar editar texto.utils.ts.
 */
const MARCAS_CONHECIDAS: string[] = [];

/**
 * Busca produtos parecidos com a descrição informada, priorizando palavras
 * em comum. Usada no fluxo de "produto não encontrado" para reaproveitar
 * NCM / CEST / situação tributária de produtos equivalentes já cadastrados.
 */
export async function buscarSimilares(
  descricaoBusca: string,
  opcoes: { limite?: number; excluirId?: number } = {}
): Promise<SugestaoSimilar[]> {
  const limite = opcoes.limite ?? 8;
  const todosProdutos = await produtosService.listarTodosParaSimilaridade(opcoes.excluirId);
  if (todosProdutos.length === 0) return [];

  const queryNormalizada = removerMarcasConhecidas(
    normalizarTexto(descricaoBusca),
    MARCAS_CONHECIDAS
  );
  const queryTokens = tokenizar(queryNormalizada);

  // Fuse.js cuida da similaridade textual "fuzzy" (erros de digitação,
  // pequenas variações). Indexamos pela descrição original.
  const fuse = new Fuse(todosProdutos, {
    keys: ['descricao'],
    includeScore: true,
    threshold: 0.55,
    ignoreLocation: true,
    distance: 200,
    minMatchCharLength: 2,
  });

  const resultadosFuse = fuse.search(descricaoBusca, { limit: limite * 4 });

  const candidatos: SugestaoSimilar[] = resultadosFuse.map((r) => {
    const produto = r.item as Produto;
    const fuseScore = r.score ?? 1; // 0 = match perfeito, 1 = nenhum match
    const similaridadeFuse = 1 - fuseScore;

    const descricaoProdutoNormalizada = removerMarcasConhecidas(
      normalizarTexto(produto.descricao),
      MARCAS_CONHECIDAS
    );
    const produtoTokens = tokenizar(descricaoProdutoNormalizada);
    const similaridadePalavras = similaridadeJaccard(queryTokens, produtoTokens);

    const similaridadeFinal = similaridadeFuse * 0.5 + similaridadePalavras * 0.5;

    return { produto, similaridade: Math.round(similaridadeFinal * 1000) / 1000 };
  });

  return candidatos.sort((a, b) => b.similaridade - a.similaridade).slice(0, limite);
}