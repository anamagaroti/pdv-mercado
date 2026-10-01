import { query, queryPdv } from "../../db/firebirdPool";
import { linhaParaProduto, CAMPO_PARA_COLUNA, valorParaColuna } from "./produtos.mapper";
import { Produto, ProdutoEditavel, NovoProdutoInput } from "../../types/produto";

// Se o nome real da tabela no seu Firebird for diferente (ex.: "PRODUTO",
// singular), ajuste só aqui.
const TABELA = "PRODUTOS";

/**
 * PRODUTOS tem 3 FKs (SITUACAOTRIBUTARIAIDO, GRUPOIMPOSTOIDO,
 * GRUPOPISCOFINSIDO). Se o valor enviado não existir na tabela referenciada,
 * o Firebird recusa o INSERT/UPDATE com uma mensagem técnica sobre a
 * constraint. Aqui a gente traduz isso pra algo que o usuário entende.
 */
function traduzirErroDeEscrita(erro: any): Error {
  const msg = String(erro?.message ?? "");
  if (/FK_PRODUTOS_SITUACAOTRIBUTARIA/i.test(msg)) {
    return new Error(
      "Situação tributária inválida: esse código não existe na tabela SITUACAOTRIBUTARIA."
    );
  }
  if (/FK_PRODUTOS_GRUPOIMPOSTO/i.test(msg)) {
    return new Error("Grupo de imposto inválido: esse código não existe na tabela GRUPOIMPOSTO.");
  }
  if (/FK_PRODUTOS_GERUPOPISCOFINS/i.test(msg)) {
    return new Error(
      "Grupo de PIS/COFINS inválido: esse código não existe na tabela GRUPOPISCOFINS."
    );
  }
  return erro instanceof Error ? erro : new Error(msg || "Erro ao gravar no Firebird.");
}

export async function buscarPorCodigoBarras(codigoBarras: string): Promise<Produto | undefined> {
  const linhas = await query(
    `SELECT * FROM ${TABELA} WHERE CODIGOBARRA = ?`,
    [codigoBarras.trim()]
  );
  return linhas[0] ? linhaParaProduto(linhas[0]) : undefined;
}

export async function buscarPorId(id: number): Promise<Produto | undefined> {
  const linhas = await query(`SELECT * FROM ${TABELA} WHERE PRODUTOIDO = ?`, [id]);
  return linhas[0] ? linhaParaProduto(linhas[0]) : undefined;
}

export interface FiltrosListagem {
  pagina?: number;
  tamanhoPagina?: number;
  termo?: string; // busca livre em descrição/código de barras/ncm
  semNcm?: boolean;
  semSituacaoTributaria?: boolean;
}

export interface ResultadoListagem {
  produtos: Produto[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

function montarCondicoes(filtros: FiltrosListagem): { where: string; params: any[] } {
  const condicoes: string[] = [];
  const params: any[] = [];

  if (filtros.termo && filtros.termo.trim()) {
    // codigo_interno e marca não existem mais no Firebird, então saem da busca
    condicoes.push("(DESCRICAO LIKE ? OR CODIGOBARRA LIKE ? OR CLASSFICACAOFISCAL LIKE ?)");
    const like = `%${filtros.termo.trim()}%`;
    params.push(like, like, like);
  }
  if (filtros.semNcm) {
    condicoes.push("(CLASSFICACAOFISCAL IS NULL OR TRIM(CLASSFICACAOFISCAL) = '')");
  }
  if (filtros.semSituacaoTributaria) {
    condicoes.push("(SITUACAOTRIBUTARIAIDO IS NULL OR TRIM(SITUACAOTRIBUTARIAIDO) = '')");
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  return { where, params };
}

export async function listar(filtros: FiltrosListagem = {}): Promise<ResultadoListagem> {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const tamanhoPagina = Math.min(200, Math.max(1, filtros.tamanhoPagina ?? 50));
  const offset = (pagina - 1) * tamanhoPagina;

  const { where, params } = montarCondicoes(filtros);

  const totalLinhas = await query(`SELECT COUNT(*) AS TOTAL FROM ${TABELA} ${where}`, params);
  const total = Number(totalLinhas[0]?.TOTAL ?? 0);

  // Firebird não tem LIMIT/OFFSET: usa FIRST <n> SKIP <m>.
  // Sem atualizado_em (não existe mais), ordena por descrição.
  const linhas = await query(
    `SELECT FIRST ? SKIP ? * FROM ${TABELA} ${where} ORDER BY DESCRICAO`,
    [tamanhoPagina, offset, ...params]
  );

  return {
    produtos: linhas.map(linhaParaProduto),
    total,
    pagina,
    tamanhoPagina,
  };
}

/** Igual a listar(), mas sem paginação — usado na exportação para XLSX. */
export async function listarParaExportacao(
  filtros: Omit<FiltrosListagem, "pagina" | "tamanhoPagina"> = {}
): Promise<Produto[]> {
  const { where, params } = montarCondicoes(filtros);
  const linhas = await query(`SELECT * FROM ${TABELA} ${where} ORDER BY DESCRICAO`, params);
  return linhas.map(linhaParaProduto);
}

export async function criar(dados: NovoProdutoInput): Promise<Produto> {
  try {

    await query(
      `INSERT INTO ${TABELA}
        (
          DESCRICAO,
          DESCRICAOCOMPLETA,
          MARCAIDO,
          UNIDADEMEDIDA,
          UNIDADEMEDIDATRIBUTAVEL,
          QUANTIDADETRIBUTAVEL,
          TIPOUNIDADE,
          VALORVENDA,
          CODIGOBARRA,
          ITEMATIVO,
          PRODUTOCOMPOSTO,
          PRECOPROMOCIONAL,
          PRODUTOEMPROMOCAO,
          DESCONTOMAXIMO,
          GRUPOIDO,
          SITUACAOTRIBUTARIAIDO,
          GRUPOIMPOSTOIDO,
          GRUPOPISCOFINSIDO,
          CLASSFICACAOFISCAL,
          CODIGOCEST,
          ORIGEMPRODUTO
        )
       VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       )`,
      [
        dados.descricao,
        dados.descricao_completa ?? dados.descricao,
        dados.marca_id ?? 1,                 // default MARCAIDO = 1
        dados.unidade ?? "UN",
        dados.unidade_medida_tributavel ?? dados.unidade ?? "UN",
        dados.quantidade_tributavel ?? 1,
        dados.tipo_unidade ?? "U",                  
        dados.preco,
        dados.codigo_barras,
        dados.ativo === false ? "N" : "S",
        dados.produto_composto ? "S" : "N",
        dados.preco_promocional ?? 0,
        dados.em_promocao ? "S" : "N",
        dados.desconto_maximo ?? 0,
        dados.grupo_id ?? 1,                 // default GRUPOIDO = 1
        dados.situacao_tributaria ?? 'F00',
        dados.grupo_imposto ?? 1,
        dados.grupo_pis_cofins ?? 1,
        dados.ncm ?? '',
        dados.cest ?? '',
        dados.origem ?? '',
      ]
    );

    const linhas = await query<{ ID: number }>(
      `SELECT COALESCE(MAX(PRODUTOIDO), 0) AS ID FROM PRODUTOS`
    );
    const novoId = Number(linhas[0].ID);

    const produtoFirebird = (await buscarPorId(novoId))!;

    await replicarProdutoPDV(produtoFirebird);

    return produtoFirebird;
  } catch (erro: any) {
    throw traduzirErroDeEscrita(erro);
  }
}

export async function replicarProdutoPDV(produto: Produto): Promise<void> {
  await queryPdv(
      `INSERT INTO ${TABELA}
        (
          PRODUTOIDO,
          DESCRICAO,
          UNIDADEMEDIDA,
          VALORVENDA,
          CODIGOBARRA,
          ITEMATIVO,
          PRODUTOCOMPOSTO,
          PRECOPROMOCIONAL,
          PRODUTOEMPROMOCAO,
          DESCONTOMAXIMO,
          SITUACAOTRIBUTARIAIDO,
          GRUPOIMPOSTOIDO,
          GRUPOPISCOFINSIDO,
          CLASSFICACAOFISCAL,
          CODIGOCEST,
          ORIGEMPRODUTO
        )
       VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       )`,
      [
        produto.id,
        produto.descricao,
        produto.unidade ?? "UN",
        produto.preco,
        produto.codigo_barras,
        produto.ativo === false ? "N" : "S",
        produto.produto_composto ? "S" : "N",
        produto.preco_promocional ?? 0,
        produto.em_promocao ? "S" : "N",
        produto.desconto_maximo ?? 0,
        produto.situacao_tributaria ?? 'F00',
        produto.grupo_imposto ?? 1,
        produto.grupo_pis_cofins ?? 1,
        produto.ncm ?? '',
        produto.cest ?? '',
        produto.origem ?? '',
      ]
    );
} 

/**
 * Colunas que existem na tabela PRODUTOS do banco PDV — precisa ficar em
 * sincronia com replicarProdutoPDV(). Se um campo novo for adicionado na
 * tabela PDV no futuro, inclua a coluna aqui também.
 */
const COLUNAS_PDV = new Set([
  "DESCRICAO",
  "UNIDADEMEDIDA",
  "VALORVENDA",
  "CODIGOBARRA",
  "ITEMATIVO",
  "PRODUTOCOMPOSTO",
  "PRECOPROMOCIONAL",
  "PRODUTOEMPROMOCAO",
  "DESCONTOMAXIMO",
  "SITUACAOTRIBUTARIAIDO",
  "GRUPOIMPOSTOIDO",
  "GRUPOPISCOFINSIDO",
  "CLASSFICACAOFISCAL",
  "CODIGOCEST",
  "ORIGEMPRODUTO",
]);

/**
 * Atualiza um produto existente. Sem tabela de histórico no Firebird (não
 * criamos schema novo), então aqui só aplica os campos enviados — não há
 * mais o registro de valor_anterior/valor_novo que existia no SQLite.
 *
 * Atualiza primeiro o Comer (fonte da verdade) e, se dado com sucesso,
 * replica os mesmos campos (filtrados pelo schema do PDV) nesse segundo
 * banco. Se o produto ainda não existir no PDV (por exemplo, cadastrado
 * antes da réplica dupla existir), cai no INSERT via replicarProdutoPDV
 * em vez de falhar silenciosamente.
 */
export async function atualizar(id: number, dados: ProdutoEditavel): Promise<Produto> {
  const produtoAtual = await buscarPorId(id);
  if (!produtoAtual) {
    throw new Error(`Produto ${id} não encontrado`);
  }

  const colunas: string[] = [];
  const valores: any[] = [];
  const colunasPdv: string[] = [];
  const valoresPdv: any[] = [];

  for (const [campo, coluna] of Object.entries(CAMPO_PARA_COLUNA)) {
    if (!(campo in dados)) continue;
    const valor = (dados as any)[campo];
    if (valor === undefined) continue;

    const valorConvertido = valorParaColuna(campo, valor);

    colunas.push(`${coluna} = ?`);
    valores.push(valorConvertido);

    if (COLUNAS_PDV.has(coluna)) {
      colunasPdv.push(`${coluna} = ?`);
      valoresPdv.push(valorConvertido);
    }
  }

  if (colunas.length === 0) {
    return produtoAtual; // nada mudou, evita escrita desnecessária
  }

  try {
    await query(`UPDATE ${TABELA} SET ${colunas.join(", ")} WHERE PRODUTOIDO = ?`, [
      ...valores,
      id,
    ]);
  } catch (erro: any) {
    throw traduzirErroDeEscrita(erro);
  }

  const produtoAtualizado = (await buscarPorId(id))!;

  await replicarAtualizacaoPDV(produtoAtualizado.id, colunasPdv, valoresPdv, produtoAtualizado);

  return produtoAtualizado;
}

/**
 * Aplica no PDV as mesmas mudanças feitas no Comer. Se o produto não
 * existir ainda no PDV (registro criado antes da réplica dupla, ou
 * dessincronizado por algum motivo), cadastra ele agora via
 * replicarProdutoPDV em vez de deixar o PDV desatualizado.
 */
async function replicarAtualizacaoPDV(
  id: number,
  colunasPdv: string[],
  valoresPdv: any[],
  produtoAtualizado: Produto
): Promise<void> {
  if (colunasPdv.length === 0) return; // nenhum campo alterado existe no schema do PDV

  try {
    // node-firebird não retorna rowCount de forma confiável em UPDATE;
    // confirmamos a existência do registro consultando de volta.
    const existeNoPdv = await queryPdv<{ PRODUTOIDO: number }>(
      `SELECT PRODUTOIDO FROM ${TABELA} WHERE PRODUTOIDO = ?`,
      [id]
    );

    if (existeNoPdv.length === 0) {
      // produto nunca foi replicado — cadastra agora pra reconciliar os bancos
      await replicarProdutoPDV(produtoAtualizado);
    }else{
      await queryPdv(
      `UPDATE ${TABELA} SET ${colunasPdv.join(", ")} WHERE PRODUTOIDO = ?`,
      [...valoresPdv, id]
      );
    }
  } catch (erro: any) {
    // Não deixamos a falha de sincronização com o PDV derrubar a operação
    // no Comer, que já foi persistida com sucesso. Logamos para investigação.
    console.error(`[produtos] Falha ao replicar atualização do produto ${id} no PDV:`, erro);
  }
}

/**
 * Upsert usado pela importação de planilha: se já existe produto com o
 * mesmo código de barras, atualiza; senão, cria um novo registro.
 */
export async function upsertPorCodigoBarras(
  codigoBarras: string,
  dados: ProdutoEditavel
): Promise<{ produto: Produto; criado: boolean }> {
  const existente = await buscarPorCodigoBarras(codigoBarras);
  if (existente) {
    const produto = await atualizar(existente.id, dados);
    return { produto, criado: false };
  }
  const produto = await criar({
    ...dados,
    codigo_barras: codigoBarras,
    descricao: dados.descricao ?? "(sem descrição)",
    preco: dados.preco ?? 0,
  });
  return { produto, criado: true };
}

/**
 * ATENÇÃO: como esta tabela é do ERP e pode ter vendas/notas vinculadas ao
 * PRODUTOIDO, optamos por "desativar" (ITEMATIVO = 'N') em vez de fazer
 * DELETE físico, para não correr o risco de violar integridade referencial
 * no banco de produção. Se quiser DELETE de verdade, me avise que eu troco.
 */
export async function excluir(id: number): Promise<void> {
  await query(`UPDATE ${TABELA} SET ITEMATIVO = 'N' WHERE PRODUTOIDO = ?`, [id]);
}

export async function listarTodosNcmsUnicos(): Promise<string[]> {
  const linhas = await query(
    `SELECT DISTINCT CLASSFICACAOFISCAL AS NCM FROM ${TABELA}
     WHERE CLASSFICACAOFISCAL IS NOT NULL AND TRIM(CLASSFICACAOFISCAL) != ''`
  );
  return linhas.map((l) => String(l.NCM).trim());
}

export async function listarTodosParaValidacaoNcm(): Promise<Produto[]> {
  const linhas = await query(`SELECT * FROM ${TABELA}`);
  return linhas.map(linhaParaProduto);
}

export async function listarTodosParaSimilaridade(excluirId?: number): Promise<Produto[]> {
  const linhas = excluirId
    ? await query(`SELECT * FROM ${TABELA} WHERE PRODUTOIDO != ?`, [excluirId])
    : await query(`SELECT * FROM ${TABELA}`);
  return linhas.map(linhaParaProduto);
}