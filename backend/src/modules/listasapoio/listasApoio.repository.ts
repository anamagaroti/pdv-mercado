import { query } from "../../db/firebirdPool";

export interface OpcaoListaApoio {
  id: string | number;
  descricao: string;
}

/** Valores válidos para PRODUTOS.SITUACAOTRIBUTARIAIDO */
export async function listarSituacoesTributarias(): Promise<OpcaoListaApoio[]> {
  const linhas = await query(
    "SELECT SITUACAOTRIBUTARIAIDO, DESCRICAOSITUACAO FROM SITUACAOTRIBUTARIA ORDER BY SITUACAOTRIBUTARIAIDO"
  );
  return linhas.map((l) => ({
    id: String(l.SITUACAOTRIBUTARIAIDO).trim(),
    descricao: String(l.DESCRICAOSITUACAO ?? "").trim(),
  }));
}

/** Valores válidos para PRODUTOS.GRUPOIMPOSTOIDO */
export async function listarGruposImposto(): Promise<OpcaoListaApoio[]> {
  const linhas = await query(
    "SELECT GRUPOIMPOSTOIDO, DESCRICAO FROM GRUPOIMPOSTO ORDER BY DESCRICAO"
  );
  return linhas.map((l) => ({
    id: Number(l.GRUPOIMPOSTOIDO),
    descricao: String(l.DESCRICAO ?? "").trim(),
  }));
}

/** Valores válidos para PRODUTOS.GRUPOPISCOFINSIDO */
export async function listarGruposPisCofins(): Promise<OpcaoListaApoio[]> {
  const linhas = await query(
    "SELECT CODIGOGRUPOPISCOFINS, DESCRICAOGRUPO FROM GRUPOPISCOFINS ORDER BY DESCRICAOGRUPO"
  );
  return linhas.map((l) => ({
    id: Number(l.CODIGOGRUPOPISCOFINS),
    descricao: String(l.DESCRICAOGRUPO ?? "").trim(),
  }));
}
