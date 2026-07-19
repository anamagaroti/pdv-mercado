-- Schema do banco SQLite — fonte de verdade do sistema.
-- O Excel é usado apenas como ENTRADA (importação) e SAÍDA (exportação),
-- nunca como armazenamento durante o uso do sistema.

CREATE TABLE IF NOT EXISTS produtos (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_barras         TEXT UNIQUE,
  codigo_interno        TEXT,
  descricao             TEXT NOT NULL,
  preco                 REAL,
  ncm                   TEXT,
  grupo                 TEXT,
  situacao_tributaria   TEXT,
  marca                 TEXT,
  unidade               TEXT,
  cest                  TEXT,
  origem                TEXT,
  -- Colunas da planilha original que não têm um campo fixo correspondente
  -- ficam preservadas aqui como JSON, sem perder informação na importação.
  campos_extra          TEXT,
  -- Marca produtos criados pelo sistema (fora da importação original)
  criado_pelo_sistema   INTEGER NOT NULL DEFAULT 0,
  criado_em             TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_interno ON produtos(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_produtos_descricao ON produtos(descricao);
CREATE INDEX IF NOT EXISTS idx_produtos_ncm ON produtos(ncm);
CREATE INDEX IF NOT EXISTS idx_produtos_marca ON produtos(marca);
CREATE INDEX IF NOT EXISTS idx_produtos_atualizado_em ON produtos(atualizado_em);

-- Histórico de alterações por campo, para auditoria e para a futura
-- funcionalidade de "histórico de alterações" prevista no escopo.
CREATE TABLE IF NOT EXISTS historico_alteracoes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id      INTEGER NOT NULL,
  campo           TEXT NOT NULL,
  valor_anterior  TEXT,
  valor_novo      TEXT,
  alterado_em     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_historico_produto_id ON historico_alteracoes(produto_id);

-- Cache de validação de NCM. Evita repetir consultas: cada NCM único do
-- sistema é validado uma vez contra a fonte oficial e o resultado fica
-- salvo aqui até expirar (ver NCM_CACHE_DAYS) ou ser revalidado manualmente.
CREATE TABLE IF NOT EXISTS ncm_cache (
  ncm                 TEXT PRIMARY KEY,
  status              TEXT NOT NULL, -- valido | invalido | nao_encontrado
  descricao_oficial   TEXT,
  data_inicio_vigencia TEXT,
  data_fim_vigencia   TEXT,
  ncm_sugerido        TEXT,
  verificado_em       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Histórico de importações de planilhas (auditoria + mapeamento usado)
CREATE TABLE IF NOT EXISTS importacoes (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_arquivo          TEXT,
  mapeamento_colunas    TEXT, -- JSON: { coluna_planilha: campo_sistema }
  total_linhas          INTEGER,
  total_novos           INTEGER,
  total_atualizados     INTEGER,
  total_erros           INTEGER,
  importado_em          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configurações livres do sistema (chave/valor), usada por exemplo para
-- lembrar o último mapeamento de colunas e preferências do validador de NCM.
CREATE TABLE IF NOT EXISTS configuracoes (
  chave   TEXT PRIMARY KEY,
  valor   TEXT NOT NULL
);

-- ── Módulo de NF-e de compra ──────────────────────────────────────────────

-- Cabeçalho das NF-es importadas
CREATE TABLE IF NOT EXISTS nfes (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  chave_acesso        TEXT UNIQUE,
  numero              TEXT,
  serie               TEXT,
  data_emissao        TEXT,
  natureza_operacao   TEXT,
  emitente_cnpj       TEXT,
  emitente_nome       TEXT,
  emitente_ie         TEXT,
  emitente_uf         TEXT,
  valor_produtos      REAL,
  valor_frete         REAL,
  valor_seguro        REAL,
  valor_desconto      REAL,
  valor_ipi           REAL,
  valor_icms          REAL,
  valor_icms_st       REAL,
  valor_pis           REAL,
  valor_cofins        REAL,
  valor_outro         REAL,
  valor_total         REAL,
  importado_em        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Itens de cada NF-e com todos os campos fiscais relevantes para precificação
CREATE TABLE IF NOT EXISTS nfe_itens (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  nfe_id                    INTEGER NOT NULL,
  numero_item               INTEGER,
  codigo_fornecedor         TEXT,
  codigo_barras             TEXT,
  descricao                 TEXT,
  ncm                       TEXT,
  cfop                      TEXT,
  unidade                   TEXT,
  quantidade                REAL,
  unidade_tributavel        TEXT,
  quantidade_tributavel     REAL,
  unidades_por_embalagem    REAL,
  valor_unitario            REAL,
  valor_total_item          REAL,
  valor_desconto_item       REAL,
  valor_frete_item          REAL,
  valor_outro_item          REAL,
  -- ICMS
  cst_icms                  TEXT,
  orig_icms                 TEXT,
  base_icms                 REAL,
  perc_icms                 REAL,
  valor_icms                REAL,
  -- ICMS-ST
  base_icms_st              REAL,
  perc_icms_st              REAL,
  valor_icms_st             REAL,
  -- IPI
  cst_ipi                   TEXT,
  perc_ipi                  REAL,
  valor_ipi                 REAL,
  -- PIS
  cst_pis                   TEXT,
  perc_pis                  REAL,
  valor_pis                 REAL,
  -- COFINS
  cst_cofins                TEXT,
  perc_cofins               REAL,
  valor_cofins              REAL,
  -- Custo calculado (preenchido na importação, re-calculado na tela)
  custo_unitario_calculado  REAL,
  -- Link para o produto cadastrado no sistema (se existir)
  produto_id                INTEGER,
  FOREIGN KEY (nfe_id) REFERENCES nfes(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE INDEX IF NOT EXISTS idx_nfe_itens_nfe_id ON nfe_itens(nfe_id);
CREATE INDEX IF NOT EXISTS idx_nfe_itens_codigo_barras ON nfe_itens(codigo_barras);

