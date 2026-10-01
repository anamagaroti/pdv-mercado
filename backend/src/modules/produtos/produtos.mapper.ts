import { Produto } from "../../types/produto";

/** Firebird costuma retornar CHAR (não VARCHAR) com padding de espaços. */
function textoOuIndefinido(valor: any): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  const texto = String(valor).trim();
  return texto === "" ? undefined : texto;
}

function numeroOuIndefinido(valor: any): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  return Number(valor);
}

function boolDeSN(valor: any): boolean {
  return String(valor ?? "").trim().toUpperCase() === "S";
}

function snDeBool(valor: boolean | undefined, quandoIndefinido: "S" | "N" = "N"): "S" | "N" {
  if (valor === undefined) return quandoIndefinido;
  return valor ? "S" : "N";
}

/** Linha crua do Firebird (SELECT * FROM PRODUTOS) -> Produto do app. */
export function linhaParaProduto(linha: any): Produto {
  return {
    id: Number(linha.PRODUTOIDO),
    descricao: String(linha.DESCRICAO ?? "").trim(),
    descricao_completa: textoOuIndefinido(linha.DESCRICAOCOMPLETA),
    unidade_medida_tributavel: textoOuIndefinido(linha.UNIDADEMEDIDATRIBUTAVEL),
    quantidade_tributavel: numeroOuIndefinido(linha.QUANTIDADETRIBUTAVEL),
    preco: numeroOuIndefinido(linha.VALORVENDA) ?? 0,
    preco_promocional: numeroOuIndefinido(linha.PRECOPROMOCIONAL),
    em_promocao: boolDeSN(linha.PRODUTOEMPROMOCAO),
    codigo_barras: String(linha.CODIGOBARRA ?? "").trim(),
    ativo: boolDeSN(linha.ITEMATIVO),
    produto_composto: boolDeSN(linha.PRODUTOCOMPOSTO),
    desconto_maximo: numeroOuIndefinido(linha.DESCONTOMAXIMO),
    situacao_tributaria: textoOuIndefinido(linha.SITUACAOTRIBUTARIAIDO),
    grupo_imposto: numeroOuIndefinido(linha.GRUPOIMPOSTOIDO),
    grupo_pis_cofins: numeroOuIndefinido(linha.GRUPOPISCOFINSIDO),
    ncm: textoOuIndefinido(linha.CLASSFICACAOFISCAL),
    cest: textoOuIndefinido(linha.CODIGOCEST),
    origem: textoOuIndefinido(linha.ORIGEMPRODUTO),
    unidade: String(linha.UNIDADEMEDIDA ?? "").trim(),
    tipo_unidade: String(linha.TIPOUNIDADE ?? "").trim(),
    preco_custo: numeroOuIndefinido(linha.VALORCUSTO),
    marca_id: numeroOuIndefinido(linha.MARCAIDO),
    grupo_id: numeroOuIndefinido(linha.GRUPOIDO),
  };
}

/** Nome do campo do app (snake_case) -> nome da coluna real no Firebird. */
export const CAMPO_PARA_COLUNA: Record<string, string> = {
  descricao: "DESCRICAO",
  descricao_completa: "DESCRICAOCOMPLETA",
  unidade: "UNIDADEMEDIDA",
  unidade_medida_tributavel: "UNIDADEMEDIDATRIBUTAVEL",
  quantidade_tributavel: "QUANTIDADETRIBUTAVEL",
  tipo_unidade: "TIPOUNIDADE",
  preco: "VALORVENDA",
  preco_promocional: "PRECOPROMOCIONAL",
  em_promocao: "PRODUTOEMPROMOCAO",
  codigo_barras: "CODIGOBARRA",
  ativo: "ITEMATIVO",
  produto_composto: "PRODUTOCOMPOSTO",
  desconto_maximo: "DESCONTOMAXIMO",
  situacao_tributaria: "SITUACAOTRIBUTARIAIDO",
  grupo_imposto: "GRUPOIMPOSTOIDO",
  grupo_pis_cofins: "GRUPOPISCOFINSIDO",
  ncm: "CLASSFICACAOFISCAL",
  cest: "CODIGOCEST",
  origem: "ORIGEMPRODUTO",
};

/**
 * Tamanho máximo de cada coluna no Firebird (varchar/char). Usado para
 * truncar defensivamente antes de gravar — sem isso o Firebird recusa o
 * INSERT/UPDATE inteiro com "string right truncation" em vez de só cortar.
 */
const TAMANHOS_MAXIMOS: Partial<Record<string, number>> = {
  descricao: 40,
  descricao_completa: 80,
  unidade: 3,
  unidade_medida_tributavel: 2,
  codigo_barras: 13,
  situacao_tributaria: 3,
  ncm: 8,
  cest: 7,
  origem: 1,
};

export function truncarParaColuna(campo: string, valor: any): any {
  if (typeof valor !== "string") return valor;
  const max = TAMANHOS_MAXIMOS[campo];
  if (!max || valor.length <= max) return valor;
  return valor.slice(0, max);
}

const CAMPOS_BOOLEANOS_SN = new Set(["ativo", "em_promocao", "produto_composto"]);

/** Converte o valor de um campo do app para o formato esperado pela coluna do Firebird. */
export function valorParaColuna(campo: string, valor: any): any {
  if (CAMPOS_BOOLEANOS_SN.has(campo)) {
    return snDeBool(valor as boolean, "N");
  }
  return truncarParaColuna(campo, valor);
}