import { MapeamentoColunas } from '../../types/produto';
import { normalizarTexto } from '../busca/texto.utils';

/**
 * Mapeamento de variações de nomes de coluna — inclui os nomes exatos
 * do ERP do cliente (PRODUTOIDO, DESCRICAO, NOMEGRUPO, SUBGRUPO, etc.)
 * além das variações comuns de outros sistemas.
 */
const DICIONARIO: Record<string, string[]> = {
  codigo_barras: [
    'codigobarra', 'codigo de barras', 'código de barras', 'codigo barras',
    'cod barras', 'cod de barras', 'ean', 'gtin', 'codbarras', 'barras', 'codigobarra',
  ],
  codigo_interno: [
    'produtoido', 'produtoid', 'produto id', 'codigo', 'código', 'cod',
    'codigo interno', 'código interno', 'referencia', 'referência', 'ref',
    'codigo produto', 'código produto', 'id',
  ],
  descricao: [
    'descricao', 'descrição', 'nome', 'produto', 'nome do produto',
    'descricao do produto', 'descrição do produto', 'mercadoria',
  ],
  preco: [
    'valorvenda', 'valor venda', 'preco', 'preço', 'valor', 'preco venda',
    'preço venda', 'preco de venda', 'preço de venda', 'valor unitario',
    'valor unitário', 'preco unitario', 'preço unitário', 'vl venda',
  ],
  preco_custo: [
    'valorcusto', 'valor custo', 'preco custo', 'preço custo', 'custo',
    'custo unitario', 'custo unitário', 'vl custo', 'preco de compra', 'preço de compra',
  ],
  ncm: ['ncm', 'codigo ncm', 'código ncm', 'cod ncm'],
  grupo: [
    'nomegrupo', 'nome grupo', 'grupo', 'nome do grupo',
    'categoria', 'departamento', 'secao', 'seção',
  ],
  subgrupo: [
    'subgrupo', 'sub grupo', 'sub-grupo', 'subcategoria',
    'sub categoria', 'sub-categoria', 'linha', 'familia', 'família',
  ],
  situacao_tributaria: [
    'situacao tributaria', 'situação tributária', 'situacao tributaria icms',
    'cst', 'csosn', 'st', 'sit tributaria', 'situacaotributaria',
  ],
  marca: ['marca', 'fabricante'],
  unidade: ['unidade', 'un', 'unid', 'unidade de medida', 'und'],
  cest: ['cest', 'codigo cest', 'código cest'],
  origem: ['origem', 'origem da mercadoria', 'origem icms'],
  ativo: ['ativo', 'status', 'situacao', 'situação', 'ativado', 'habilitado'],
};

export function detectarMapeamento(colunas: string[]): MapeamentoColunas {
  const mapeamento: MapeamentoColunas = {};
  for (const coluna of colunas) {
    const colunaNorm = normalizarTexto(coluna);
    let campoEncontrado: string | null = null;
    for (const campo of Object.keys(DICIONARIO)) {
      const variacoes = DICIONARIO[campo];
      if (variacoes.some((v) => normalizarTexto(v) === colunaNorm)) {
        campoEncontrado = campo;
        break;
      }
    }
    mapeamento[coluna] = campoEncontrado as any;
  }
  return mapeamento;
}
