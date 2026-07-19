import { query } from "../../db/firebirdPool";

export interface TabelaPreco {
  id: number;
  nome: string;
  permiteItemEmPromocao: boolean;
  permiteValorPromocional: boolean;
}

export interface PrecoProduto {
  tabelaPrecoId: number;
  nomeTabela: string;
  valorVenda?: number; // undefined quando o produto ainda não tem preço definido nessa tabela
}

function boolDeSN(valor: any): boolean {
  return String(valor ?? "").trim().toUpperCase() === "S";
}

export async function listarTabelasPrecos(): Promise<TabelaPreco[]> {
  const linhas = await query(
    `SELECT TABELAPRECOIDO, NOMETABELAPRECO, PERMITIRITEMEMPROMOCAO, PERMITIRVALORPROMOCIONAL
     FROM TABELAPRECOS ORDER BY NOMETABELAPRECO`
  );
  return linhas.map((l) => ({
    id: Number(l.TABELAPRECOIDO),
    nome: String(l.NOMETABELAPRECO ?? "").trim(),
    permiteItemEmPromocao: boolDeSN(l.PERMITIRITEMEMPROMOCAO),
    permiteValorPromocional: boolDeSN(l.PERMITIRVALORPROMOCIONAL),
  }));
}

/**
 * Todos os preços de um produto, um por tabela de preço existente (LEFT JOIN,
 * então tabelas em que o produto ainda não tem preço definido também
 * aparecem, com valorVenda undefined).
 */
export async function buscarPrecosDoProduto(produtoId: number): Promise<PrecoProduto[]> {
  const linhas = await query(
    `SELECT tp.TABELAPRECOIDO, tp.NOMETABELAPRECO, tpp.VALORVENDA
     FROM TABELAPRECOS tp
     LEFT JOIN TABELAPRECOSPRODUTOS tpp
       ON tpp.TABELAPRECOIDO = tp.TABELAPRECOIDO AND tpp.PRODUTOIDO = ?
     ORDER BY tp.NOMETABELAPRECO`,
    [produtoId]
  );
  return linhas.map((l) => ({
    tabelaPrecoId: Number(l.TABELAPRECOIDO),
    nomeTabela: String(l.NOMETABELAPRECO ?? "").trim(),
    valorVenda: l.VALORVENDA != null ? Number(l.VALORVENDA) : undefined,
  }));
}

/** Cria ou atualiza o preço de um produto numa tabela de preços específica. */
export async function definirPrecoProduto(
  produtoId: number,
  valorVenda: number
): Promise<void> {
  await query(
    `UPDATE OR INSERT INTO TABELAPRECOSPRODUTOS (TABELAPRECOIDO, PRODUTOIDO, VALORVENDA)
     VALUES (?, ?, ?)
     MATCHING (PRODUTOIDO)`,
    [produtoId, valorVenda]
  );
}
