/**
 * Reflete apenas os campos existentes na tabela PRODUTOS do Firebird (ERP já
 * existente). Campos que o app antigo tinha (grupo, subgrupo, marca,
 * codigo_interno, criado_em/atualizado_em) foram removidos por não existirem
 * na tabela e por não termos permissão de DDL para criá-los.
 *
 * IMPORTANTE: essa tabela NÃO tem campo de preço de custo — só existe
 * VALORVENDA (preço de venda) e PRECOPROMOCIONAL. Não há como recuperar
 * custo a partir de PRODUTOS; se precisar disso, tem que vir de outra
 * tabela (compras/NF-e).
 *
 * situacao_tributaria, grupo_imposto e grupo_pis_cofins são chaves
 * estrangeiras (SITUACAOTRIBUTARIA, GRUPOIMPOSTO, GRUPOPISCOFINS) — só
 * aceitam valores que já existem nessas tabelas. Use os endpoints de
 * listas de apoio para popular selects em vez de campo livre de texto.
 */
export interface Produto {
  id: number; // PRODUTOIDO
  descricao: string; // DESCRICAO
  descricao_completa?: string; // DESCRICAOCOMPLETA
  unidade?: string; // UNIDADEMEDIDA (unidade comercial, ex.: CX, PC)
  unidade_medida_tributavel?: string; // UNIDADEMEDIDATRIBUTAVEL (unidade individual, ex.: UN)
  quantidade_tributavel?: number; // QUANTIDADETRIBUTAVEL (quantas unidades tributáveis tem em 1 unidade comercial — ex.: 12 latas por caixa)
  tipo_unidade?: string; // TIPOUNIDADE
  preco: number; // VALORVENDA
  /**
   * NÃO existe em PRODUTOS. É calculado pelo repository a partir de
   * TABELAPRECOSPRODUTOS na tabela configurada em
   * FIREBIRD_TABELA_PRECO_CUSTO_ID. Fica undefined se a env var não estiver
   * configurada. Não é gravável via atualizar()/criar() — use
   * tabelasPrecosApi.definirPreco no frontend.
   */
  preco_custo?: number;
  preco_promocional?: number; // PRECOPROMOCIONAL
  em_promocao: boolean; // PRODUTOEMPROMOCAO (S/N)
  codigo_barras: string; // CODIGOBARRA
  ativo: boolean; // ITEMATIVO (S/N)
  produto_composto: boolean; // PRODUTOCOMPOSTO (S/N)
  desconto_maximo?: number; // DESCONTOMAXIMO
  situacao_tributaria?: string; // SITUACAOTRIBUTARIAIDO (FK -> SITUACAOTRIBUTARIA)
  grupo_imposto?: number; // GRUPOIMPOSTOIDO (FK -> GRUPOIMPOSTO)
  grupo_pis_cofins?: number; // GRUPOPISCOFINSIDO (FK -> GRUPOPISCOFINS)
  ncm?: string; // CLASSFICACAOFISCAL
  cest?: string; // CODIGOCEST
  origem?: string; // ORIGEMPRODUTO
}

/** Campos que podem ser enviados em uma atualização (PUT). */
export type ProdutoEditavel = Partial<Omit<Produto, "id">>;

/** Campos exigidos na criação; o restante é opcional. */
export type NovoProdutoInput = Pick<Produto, "codigo_barras" | "descricao" | "preco"> &
  Partial<Omit<Produto, "id" | "codigo_barras" | "descricao" | "preco">>;

/**
 * Mapeia o nome de cada coluna da planilha importada para o campo
 * correspondente de ProdutoEditavel (ou null, se a coluna deve ser
 * ignorada / não tem correspondência conhecida).
 */
export type MapeamentoColunas = Record<string, keyof ProdutoEditavel | null>;

// ── Tipos usados pelos módulos de busca/NCM ──────────────────────────────
// (existiam no types/produto.ts original; repostos aqui após a migração
// pro Firebird. codigo_interno foi removido de todos por não existir mais.)

export interface SugestaoSimilar {
  produto: Produto;
  similaridade: number;
}

export type StatusNcm = "valido" | "invalido" | "nao_encontrado" | "sem_ncm";

export interface ResultadoValidacaoNcm {
  produto_id: number;
  descricao: string;
  codigo_barras: string | null;
  ncm: string | null;
  status: StatusNcm;
  descricao_oficial?: string | null;
  ncm_sugerido?: string | null;
}

export interface EstatisticasValidacaoNcm {
  total_produtos: number;
  total_validos: number;
  total_invalidos: number;
  total_nao_encontrados: number;
  total_sem_ncm: number;
  ncms_unicos_verificados: number;
  tempo_ms: number;
  verificado_em: string;
}

/** Linha da tabela ncm_cache (SQLite — cache de validação, independente do Firebird) */
export interface NcmCacheEntry {
  ncm: string;
  status: StatusNcm;
  descricao_oficial: string | null;
  data_inicio_vigencia: string | null;
  data_fim_vigencia: string | null;
  ncm_sugerido: string | null;
  verificado_em: string;
}