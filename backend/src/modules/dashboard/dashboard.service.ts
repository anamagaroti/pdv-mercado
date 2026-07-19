import { query } from '../../db/firebirdPool';

export interface EstatisticasDashboard {
  total_produtos: number;
  /**
   * Estes três campos dependiam de criado_em / criado_pelo_sistema /
   * historico_alteracoes, que existiam no SQLite antigo mas NÃO existem na
   * tabela PRODUTOS do Firebird (sem coluna de data de cadastro/alteração).
   * Ficam sempre null até que o ERP tenha algum jeito de rastrear isso —
   * não temos permissão de DDL para adicionar essas colunas.
   */
  produtos_cadastrados_hoje: number | null;
  produtos_novos_total: number | null;
  produtos_alterados_hoje: number | null;
  quantidade_ncms_diferentes: number;
  produtos_sem_ncm: number;
  produtos_sem_situacao_tributaria: number;
}

export async function obterEstatisticas(): Promise<EstatisticasDashboard> {
  const [totalLinhas] = await Promise.all([
    query('SELECT COUNT(*) AS TOTAL FROM PRODUTOS'),
  ]);
  const totalProdutos = Number(totalLinhas[0]?.TOTAL ?? 0);

  const ncmsLinhas = await query(
    `SELECT COUNT(DISTINCT CLASSFICACAOFISCAL) AS TOTAL FROM PRODUTOS
     WHERE CLASSFICACAOFISCAL IS NOT NULL AND TRIM(CLASSFICACAOFISCAL) != ''`
  );
  const ncmsDiferentes = Number(ncmsLinhas[0]?.TOTAL ?? 0);

  const semNcmLinhas = await query(
    `SELECT COUNT(*) AS TOTAL FROM PRODUTOS
     WHERE CLASSFICACAOFISCAL IS NULL OR TRIM(CLASSFICACAOFISCAL) = ''`
  );
  const semNcm = Number(semNcmLinhas[0]?.TOTAL ?? 0);

  const semSituacaoLinhas = await query(
    `SELECT COUNT(*) AS TOTAL FROM PRODUTOS
     WHERE SITUACAOTRIBUTARIAIDO IS NULL OR TRIM(SITUACAOTRIBUTARIAIDO) = ''`
  );
  const semSituacaoTributaria = Number(semSituacaoLinhas[0]?.TOTAL ?? 0);

  return {
    total_produtos: totalProdutos,
    produtos_cadastrados_hoje: null,
    produtos_novos_total: null,
    produtos_alterados_hoje: null,
    quantidade_ncms_diferentes: ncmsDiferentes,
    produtos_sem_ncm: semNcm,
    produtos_sem_situacao_tributaria: semSituacaoTributaria,
  };
}