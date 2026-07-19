import * as XLSX from "xlsx";
import db from "../../db/database";
import { detectarMapeamento } from "./colunas.dicionario";
import * as produtosService from "../produtos/produtos.service";
import { CAMPO_PARA_COLUNA } from "../produtos/produtos.mapper";
import { MapeamentoColunas, ProdutoEditavel } from "../../types/produto";

// Fonte de verdade de quais campos realmente existem em ProdutoEditavel hoje
// (grupo, subgrupo, marca, preco_custo, codigo_interno não existem mais).
const CAMPOS_VALIDOS = new Set(Object.keys(CAMPO_PARA_COLUNA));

const CAMPOS_NUMERICOS = new Set(["preco", "preco_promocional", "desconto_maximo"]);
const CAMPOS_BOOLEANOS = new Set(["ativo", "em_promocao", "produto_composto"]);

export interface PreviaImportacao {
  colunas: string[];
  mapeamentoSugerido: MapeamentoColunas;
  linhasAmostra: Record<string, any>[];
  totalLinhas: number;
}

function lerPlanilhaComoObjetos(buffer: Buffer): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const primeiraAba = workbook.SheetNames[0];
  const planilha = workbook.Sheets[primeiraAba];
  // defval: '' garante que células vazias não quebrem o mapeamento de colunas
  return XLSX.utils.sheet_to_json(planilha, { defval: "" });
}

/**
 * Lê a planilha e devolve uma prévia: colunas detectadas, sugestão de
 * mapeamento automático e uma amostra de linhas, para o usuário confirmar
 * (ou ajustar manualmente) antes de importar de fato.
 */
export function gerarPrevia(buffer: Buffer): PreviaImportacao {
  const linhas = lerPlanilhaComoObjetos(buffer);
  const colunas = linhas.length > 0 ? Object.keys(linhas[0]) : [];
  const mapeamentoSugerido = detectarMapeamento(colunas);

  return {
    colunas,
    mapeamentoSugerido,
    linhasAmostra: linhas.slice(0, 5),
    totalLinhas: linhas.length,
  };
}

function converterPreco(valor: any): number | undefined {
  if (valor === "" || valor === null || valor === undefined) return undefined;
  if (typeof valor === "number") return valor;
  // Aceita formatos brasileiros como "12,90" ou "R$ 12,90"
  const limpo = String(valor)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3},)/g, "") // remove separador de milhar antes da vírgula decimal
    .replace(",", ".");
  const numero = parseFloat(limpo);
  return isNaN(numero) ? undefined : numero;
}

function converterBooleano(valor: any): boolean | undefined {
  if (valor === "" || valor === null || valor === undefined) return undefined;
  return /^(s|sim|1|true|ativo)$/i.test(String(valor).trim());
}

export interface ResultadoImportacao {
  total_linhas: number;
  total_novos: number;
  total_atualizados: number;
  total_erros: number;
  erros: { linha: number; mensagem: string }[];
}

/**
 * Importa a planilha, gravando os produtos no Firebird (fonte de verdade
 * do produto) e registrando um resumo da importação no SQLite (tabela
 * `importacoes`, que continua local — não faz parte do ERP).
 *
 * Virou async porque produtosService.upsertPorCodigoBarras agora bate no
 * Firebird. Por isso não dá mais pra envolver isso num db.transaction()
 * do SQLite: são bancos diferentes, sem atomicidade cruzada possível — o
 * processamento das linhas acontece sequencialmente fora de transação.
 */
export async function importar(
  buffer: Buffer,
  mapeamento: MapeamentoColunas,
  nomeArquivo: string
): Promise<ResultadoImportacao> {
  const linhas = lerPlanilhaComoObjetos(buffer);

  let totalNovos = 0;
  let totalAtualizados = 0;
  const erros: { linha: number; mensagem: string }[] = [];

  const colunasMapeadas = Object.entries(mapeamento).filter(
    ([, campo]) => campo !== null && CAMPOS_VALIDOS.has(campo as string)
  ) as [string, keyof ProdutoEditavel][];

  for (let indice = 0; indice < linhas.length; indice++) {
    const linha = linhas[indice];
    try {
      const dados: ProdutoEditavel = {};
      const camposExtra: Record<string, any> = {};

      for (const [colunaOriginal, valor] of Object.entries(linha)) {
        const campoCorrespondente = colunasMapeadas.find(([c]) => c === colunaOriginal)?.[1];
        if (!campoCorrespondente) {
          if (valor !== "") camposExtra[colunaOriginal] = valor;
          continue;
        }

        if (CAMPOS_NUMERICOS.has(campoCorrespondente)) {
          (dados as any)[campoCorrespondente] = converterPreco(valor);
        } else if (CAMPOS_BOOLEANOS.has(campoCorrespondente)) {
          (dados as any)[campoCorrespondente] = converterBooleano(valor);
        } else {
          (dados as any)[campoCorrespondente] = valor === "" ? undefined : String(valor).trim();
        }
      }

      const codigoBarras = dados.codigo_barras;
      if (!codigoBarras) {
        erros.push({ linha: indice + 2, mensagem: "Linha sem código de barras — ignorada." });
        continue;
      }
      if (!dados.descricao) {
        dados.descricao = "(sem descrição)";
      }

      const { criado } = await produtosService.upsertPorCodigoBarras(codigoBarras, dados);
      if (criado) totalNovos++;
      else totalAtualizados++;
    } catch (erro: any) {
      erros.push({ linha: indice + 2, mensagem: erro.message ?? "Erro desconhecido" });
    }
  }

  db.prepare(
    `INSERT INTO importacoes (nome_arquivo, mapeamento_colunas, total_linhas, total_novos, total_atualizados, total_erros)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    nomeArquivo,
    JSON.stringify(mapeamento),
    linhas.length,
    totalNovos,
    totalAtualizados,
    erros.length
  );

  return {
    total_linhas: linhas.length,
    total_novos: totalNovos,
    total_atualizados: totalAtualizados,
    total_erros: erros.length,
    erros: erros.slice(0, 50), // evita resposta gigante em planilhas muito problemáticas
  };
}