import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
});

// ── Tipos espelhados do backend ────────────────────────────────────────────

export interface Produto {
  id: number;
  descricao: string;
  descricao_completa?: string;
  unidade?: string;
  unidade_medida_tributavel?: string;
  quantidade_tributavel?: number;
  tipo_unidade?: string;
  preco: number;
  preco_custo?: number; // calculado via tabela de preço configurada no backend
  preco_promocional?: number;
  em_promocao: boolean;
  codigo_barras: string;
  ativo: boolean;
  produto_composto: boolean;
  desconto_maximo?: number;
  situacao_tributaria?: string; // FK -> SITUACAOTRIBUTARIA
  grupo_imposto?: number; // FK -> GRUPOIMPOSTO
  grupo_pis_cofins?: number; // FK -> GRUPOPISCOFINS
  ncm?: string;
  cest?: string;
  origem?: string;
}

// ── Listas de apoio (valores válidos das FKs de produto) ────────────────────

export interface OpcaoListaApoio {
  id: string | number;
  descricao: string;
}

export const listasApoioApi = {
  situacoesTributarias: async () => {
    const { data } = await api.get<OpcaoListaApoio[]>('/listas-apoio/situacoes-tributarias');
    return data;
  },
  gruposImposto: async () => {
    const { data } = await api.get<OpcaoListaApoio[]>('/listas-apoio/grupos-imposto');
    return data;
  },
  gruposPisCofins: async () => {
    const { data } = await api.get<OpcaoListaApoio[]>('/listas-apoio/grupos-pis-cofins');
    return data;
  },
};

// ── Tabelas de preço (preço de custo e outras tabelas vivem aqui, não em
// Produto — cada produto pode ter um valor diferente por tabela) ───────────

export interface TabelaPreco {
  id: number;
  nome: string;
  permiteItemEmPromocao: boolean;
  permiteValorPromocional: boolean;
}

export interface PrecoProduto {
  tabelaPrecoId: number;
  nomeTabela: string;
  valorVenda?: number;
}

export const tabelasPrecosApi = {
  listar: async () => {
    const { data } = await api.get<TabelaPreco[]>('/tabelas-precos');
    return data;
  },
  precosDoProduto: async (produtoId: number) => {
    const { data } = await api.get<PrecoProduto[]>(`/tabelas-precos/produto/${produtoId}`);
    return data;
  },
  definirPreco: async (produtoId: number, tabelaPrecoId: number, valorVenda: number) => {
    await api.put(`/tabelas-precos/produto/${produtoId}/${tabelaPrecoId}`, { valorVenda });
  },
};

export interface SugestaoSimilar {
  produto: Produto;
  similaridade: number;
}

export type StatusNcm = 'valido' | 'invalido' | 'nao_encontrado' | 'sem_ncm';

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

export interface ResultadoListagem {
  produtos: Produto[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

export interface EstatisticasDashboard {
  total_produtos: number;
  /** null: a tabela PRODUTOS do Firebird não tem coluna de data de cadastro/alteração */
  produtos_cadastrados_hoje: number | null;
  produtos_novos_total: number | null;
  produtos_alterados_hoje: number | null;
  quantidade_ncms_diferentes: number;
  produtos_sem_ncm: number;
  produtos_sem_situacao_tributaria: number;
}

export interface PreviaImportacao {
  colunas: string[];
  mapeamentoSugerido: Record<string, string | null>;
  linhasAmostra: Record<string, any>[];
  totalLinhas: number;
}

export interface ResultadoImportacao {
  total_linhas: number;
  total_novos: number;
  total_atualizados: number;
  total_erros: number;
  erros: { linha: number; mensagem: string }[];
}

// ── Produtos ───────────────────────────────────────────────────────────────

export const produtosApi = {
  buscarPorCodigoBarras: async (codigo: string) => {
    const { data } = await api.get<{ encontrado: boolean; produto?: Produto }>(
      `/produtos/codigo-barras/${encodeURIComponent(codigo)}`
    );
    return data;
  },

  listar: async (params: {
    pagina?: number;
    tamanhoPagina?: number;
    termo?: string;
    semNcm?: boolean;
    semSituacaoTributaria?: boolean;
  }) => {
    const { data } = await api.get<ResultadoListagem>('/produtos', { params });
    console.log('listar produtos', params, data);
    return data;
  },

  buscarPorId: async (id: number) => {
    const { data } = await api.get<Produto>(`/produtos/${id}`);
    return data;
  },

  criar: async (dados: Partial<Produto>) => {
    const { data } = await api.post<Produto>('/produtos', dados);
    return data;
  },

  atualizar: async (id: number, dados: Partial<Produto>) => {
    const { data } = await api.put<Produto>(`/produtos/${id}`, dados);
    return data;
  },

  // historico() removido: não existe mais tabela de histórico de alterações
  // no backend (Firebird sem permissão de DDL para criá-la).
};

// ── Busca ──────────────────────────────────────────────────────────────────

export const buscaApi = {
  similares: async (descricao: string, excluirId?: number) => {
    const { data } = await api.get<SugestaoSimilar[]>('/busca/similares', {
      params: { descricao, excluirId, limite: 8 },
    });
    return data;
  },

  codigoExterno: async (codigo: string) => {
    const { data } = await api.get<{
      encontrado: boolean;
      descricao?: string;
      marca?: string;
      fonte?: string;
    }>(`/busca/codigo-externo/${encodeURIComponent(codigo)}`);
    return data;
  },
};

export interface SugestaoNcm {
  codigo: string;
  descricao: string;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  origem: 'mesma_subposicao' | 'mesma_posicao' | 'mesmo_capitulo' | 'busca_texto';
}

export interface GrupoNcmProblematico {
  ncm_atual: string | null;
  status: 'invalido' | 'nao_encontrado';
  descricao_ncm_antigo: string | null;
  produtos_afetados: {
    produto_id: number;
    descricao: string;
    codigo_barras: string | null;
  }[];
  texto_busca: string;
  sugestoes: SugestaoNcm[];
  melhor_indice: number;
}

export interface CorrecaoNcm {
  produto_ids: number[];
  ncm_novo: string;
}

// ── NCM ────────────────────────────────────────────────────────────────────

export const ncmApi = {
  validarTodos: async (opcoes?: {
    forcarAtualizacaoTabela?: boolean;
    ignorarCache?: boolean;
  }) => {
    const { data } = await api.post<{
      resultados: ResultadoValidacaoNcm[];
      estatisticas: EstatisticasValidacaoNcm;
    }>('/ncm/validar-todos', opcoes ?? {});
    return data;
  },

  ultimaValidacao: async () => {
    const { data } = await api.get<ResultadoValidacaoNcm[]>('/ncm/ultima-validacao');
    return data;
  },

  analisarProblematicos: async () => {
    const { data } = await api.get<GrupoNcmProblematico[]>('/ncm/analisar-problematicos');
    return data;
  },

  aplicarCorrecoes: async (correcoes: CorrecaoNcm[]) => {
    const { data } = await api.post<{
      total_corrigidos: number;
      detalhes: { produto_id: number; ncm_novo: string; ok: boolean }[];
    }>('/ncm/aplicar-correcoes', { correcoes });
    return data;
  },

  buscarPorDescricao: async (descricao: string) => {
    const { data } = await api.get<SugestaoNcm[]>('/ncm/buscar-por-descricao', {
      params: { descricao },
    });
    return data;
  },
};

// ── NF-e ───────────────────────────────────────────────────────────────────

export interface NfeImposto {
  cst_icms: string | null; orig_icms: string | null;
  base_icms: number; perc_icms: number; valor_icms: number;
  base_icms_st: number; perc_icms_st: number; valor_icms_st: number;
  cst_ipi: string | null; perc_ipi: number; valor_ipi: number;
  cst_pis: string | null; perc_pis: number; valor_pis: number;
  cst_cofins: string | null; perc_cofins: number; valor_cofins: number;
}

export interface NfeItemEnriquecido {
  numero_item: number;
  codigo_fornecedor: string | null;
  codigo_barras: string | null;
  descricao: string;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  unidade: string | null; // unidade comercial (uCom) — ex.: CX
  quantidade: number;
  unidade_tributavel: string | null; // uTrib — ex.: UN
  quantidade_tributavel: number;
  /** Quantas unidades tributáveis tem em 1 unidade comercial (ex.: 12 latas por caixa) */
  unidades_por_embalagem: number | null;
  valor_unitario: number;
  valor_total_item: number;
  valor_desconto_item: number;
  valor_frete_item: number;
  valor_outro_item: number;
  imposto: NfeImposto;
  custo_unitario_calculado: number;
  produto_cadastrado: boolean;
  produto_id: number | null;
  preco_atual: number | null;
  preco_sugerido: number;
}

export interface NfeCompleta {
  id: number;
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  data_emissao: string | null;
  natureza_operacao: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  emitente_ie: string | null;
  emitente_uf: string | null;
  valor_produtos: number;
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_ipi: number;
  valor_icms: number;
  valor_icms_st: number;
  valor_pis: number;
  valor_cofins: number;
  valor_outro: number;
  valor_total: number;
  importado_em: string;
  itens: NfeItemEnriquecido[];
}

export interface AplicarPrecoItem {
  codigo_barras: string | null;
  produto_id: number | null;
  descricao: string;
  ncm: string | null;
  unidade: string | null;
  preco_custo: number;
  preco_venda: number;
  /**
   * O backend HOJE IGNORA este campo ao aplicar no Firebird: o valor que a
   * NF-e traz aqui é o CST/CSOSN do imposto, que é um código diferente da
   * FK SITUACAOTRIBUTARIAIDO do seu ERP. Mantido no tipo só por
   * compatibilidade; ajuste manualmente na tela de produto depois.
   */
  situacao_tributaria: string | null;
  unidade_tributavel?: string | null;
  unidades_por_embalagem?: number | null;
}

export const nfeApi = {
  importar: async (arquivo: File) => {
    const form = new FormData();
    form.append('arquivo', arquivo);
    const { data } = await api.post<NfeCompleta>('/nfe/importar', form);
    return data;
  },
  porPdf: async (arquivo: File) => {
    const form = new FormData();
    form.append('arquivo', arquivo);
    const { data } = await api.post<any>('/nfe/por-pdf', form);
    return data;
  },
  porChave: async (chave: string) => {
    const { data } = await api.post<any>('/nfe/consultar-e-importar', { chave });
    return data;
  },
  listar: async () => {
    const { data } = await api.get<any[]>('/nfe');
    return data;
  },
  buscarPorId: async (id: number) => {
    const { data } = await api.get<NfeCompleta>(`/nfe/${id}`);
    return data;
  },
  aplicarPrecos: async (itens: AplicarPrecoItem[]) => {
    const { data } = await api.post<{ atualizados: number; criados: number; erros: any[] }>(
      '/nfe/aplicar-precos', { itens }
    );
    return data;
  },
  certificadoStatus: async () => {
    const { data } = await api.get<{ configurado: boolean; valido: boolean; mensagem: string }>(
      '/nfe/certificado/status'
    );
    return data;
  },
  uploadCertificado: async (arquivo: File, senha: string) => {
    const form = new FormData();
    form.append('arquivo', arquivo);
    form.append('senha', senha);
    const { data } = await api.post<{ valido: boolean; mensagem: string }>(
      '/nfe/certificado', form
    );
    return data;
  },
  removerCertificado: async () => {
    await api.delete('/nfe/certificado');
  },
};

export const dashboardApi = {
  obterEstatisticas: async () => {
    const { data } = await api.get<EstatisticasDashboard>('/dashboard');
    return data;
  },
};

// ── Importação ─────────────────────────────────────────────────────────────

export const importacaoApi = {
  previa: async (arquivo: File) => {
    const form = new FormData();
    form.append('arquivo', arquivo);
    const { data } = await api.post<PreviaImportacao>('/importacao/previa', form);
    return data;
  },

  importar: async (arquivo: File, mapeamento: Record<string, string | null>) => {
    const form = new FormData();
    form.append('arquivo', arquivo);
    form.append('mapeamento', JSON.stringify(mapeamento));
    const { data } = await api.post<ResultadoImportacao>('/importacao/importar', form);
    return data;
  },
};