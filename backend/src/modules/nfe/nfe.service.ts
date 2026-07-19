import db from '../../db/database';
import { parseNfeXml, NfeParsed, NfeItem } from './nfeParser.service';
import * as produtosService from '../produtos/produtos.service';
import * as tabelasPrecosRepository from '../tabelapreco/tabelasPrecos.repository';

export interface NfeItemEnriquecido extends NfeItem {
  produto_cadastrado: boolean;
  produto_id: number | null;
  preco_atual: number | null;
  /** Preço de venda sugerido pelo sistema com a margem aplicada */
  preco_sugerido: number;
}

export interface NfeComItens {
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

const MARGEM_PADRAO = 40; // %

function calcularPrecoSugerido(custoUnitario: number, margem: number): number {
  return Math.round(custoUnitario * (1 + margem / 100) * 100) / 100;
}

/**
 * Importa a NF-e. Vira async porque, pra cada item, tentamos casar com um
 * produto existente pelo código de barras — e essa busca agora bate no
 * Firebird (assíncrono). Por isso os lookups de produto rodam ANTES da
 * transação SQLite (não dá pra misturar chamada assíncrona dentro de uma
 * transação síncrona do better-sqlite3), guardados num array alinhado por
 * índice com parsed.itens.
 */
export async function importarNfe(xmlBuffer: Buffer): Promise<NfeComItens> {
  const parsed = parseNfeXml(xmlBuffer);

  const produtoIdPorItem = await Promise.all(
    parsed.itens.map(async (item) => {
      if (!item.codigo_barras) return null;
      try {
        const prod = await produtosService.buscarPorCodigoBarras(item.codigo_barras);
        return prod?.id ?? null;
      } catch {
        return null;
      }
    })
  );

  const transacao = db.transaction(() => {
    const stmtNfe = db.prepare(`
      INSERT INTO nfes (
        chave_acesso, numero, serie, data_emissao, natureza_operacao,
        emitente_cnpj, emitente_nome, emitente_ie, emitente_uf,
        valor_produtos, valor_frete, valor_seguro, valor_desconto,
        valor_ipi, valor_icms, valor_icms_st, valor_pis, valor_cofins,
        valor_outro, valor_total
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(chave_acesso) DO UPDATE SET
        importado_em = datetime('now')
    `);

    stmtNfe.run(
      parsed.chave_acesso, parsed.numero, parsed.serie,
      parsed.data_emissao, parsed.natureza_operacao,
      parsed.emitente_cnpj, parsed.emitente_nome,
      parsed.emitente_ie, parsed.emitente_uf,
      parsed.totais.valor_produtos, parsed.totais.valor_frete,
      parsed.totais.valor_seguro, parsed.totais.valor_desconto,
      parsed.totais.valor_ipi, parsed.totais.valor_icms,
      parsed.totais.valor_icms_st, parsed.totais.valor_pis,
      parsed.totais.valor_cofins, parsed.totais.valor_outro,
      parsed.totais.valor_total
    );

    const nfeId = (db.prepare('SELECT id FROM nfes WHERE chave_acesso = ?').get(parsed.chave_acesso) as any)?.id
      ?? (db.prepare('SELECT last_insert_rowid() AS id').get() as any)?.id;

   const stmtItem = db.prepare(`
  INSERT INTO nfe_itens (
    nfe_id, numero_item, codigo_fornecedor, codigo_barras, descricao,
    ncm, cest, cfop, unidade, quantidade,
    unidade_tributavel, quantidade_tributavel, unidades_por_embalagem,
    valor_unitario, valor_total_item,
    valor_desconto_item, valor_frete_item, valor_outro_item,
    cst_icms, orig_icms, base_icms, perc_icms, valor_icms,
    base_icms_st, perc_icms_st, valor_icms_st,
    cst_ipi, perc_ipi, valor_ipi,
    cst_pis, perc_pis, valor_pis,
    cst_cofins, perc_cofins, valor_cofins,
    custo_unitario_calculado, produto_id
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(nfe_id, numero_item) DO UPDATE SET
    codigo_fornecedor = excluded.codigo_fornecedor,
    codigo_barras = excluded.codigo_barras,
    descricao = excluded.descricao,
    ncm = excluded.ncm,
    cest = excluded.cest,
    cfop = excluded.cfop,
    unidade = excluded.unidade,
    quantidade = excluded.quantidade,
    valor_unitario = excluded.valor_unitario,
    valor_total_item = excluded.valor_total_item,
    custo_unitario_calculado = excluded.custo_unitario_calculado,
    produto_id = excluded.produto_id
`);

    parsed.itens.forEach((item, idx) => {
      stmtItem.run(
        nfeId, item.numero_item, item.codigo_fornecedor,
        item.codigo_barras, item.descricao, item.ncm, item.cest, item.cfop,
        item.unidade, item.quantidade,
        item.unidade_tributavel, item.quantidade_tributavel, item.unidades_por_embalagem,
        item.valor_unitario,
        item.valor_total_item, item.valor_desconto_item,
        item.valor_frete_item, item.valor_outro_item,
        item.imposto.cst_icms, item.imposto.orig_icms,
        item.imposto.base_icms, item.imposto.perc_icms, item.imposto.valor_icms,
        item.imposto.base_icms_st, item.imposto.perc_icms_st, item.imposto.valor_icms_st,
        item.imposto.cst_ipi, item.imposto.perc_ipi, item.imposto.valor_ipi,
        item.imposto.cst_pis, item.imposto.perc_pis, item.imposto.valor_pis,
        item.imposto.cst_cofins, item.imposto.perc_cofins, item.imposto.valor_cofins,
        item.custo_unitario_calculado,
        produtoIdPorItem[idx]
      );
    });

    return nfeId as number;
  });

  const nfeId = transacao();
  return (await buscarNfePorId(nfeId))!;
}

/**
 * Vira async: pra cada item, busca o produto correspondente no Firebird
 * (antes era um SELECT direto no SQLite antigo, que não tem mais os dados
 * reais de produto).
 */
export async function buscarNfePorId(id: number): Promise<NfeComItens | null> {
  const nfe = db.prepare('SELECT * FROM nfes WHERE id = ?').get(id) as any;
  if (!nfe) return null;

  const itensRaw = db.prepare('SELECT * FROM nfe_itens WHERE nfe_id = ? ORDER BY numero_item').all(id) as any[];

  const itens: NfeItemEnriquecido[] = await Promise.all(
    itensRaw.map(async (row) => {
      let prod;
      try {
        prod = row.produto_id
          ? await produtosService.buscarPorId(row.produto_id)
          : row.codigo_barras
          ? await produtosService.buscarPorCodigoBarras(row.codigo_barras)
          : undefined;
      } catch {
        prod = undefined;
      }

      return {
        numero_item: row.numero_item,
        codigo_fornecedor: row.codigo_fornecedor,
        codigo_barras: row.codigo_barras,
        descricao: row.descricao,
        ncm: row.ncm,
        cest: row.cest,
        cfop: row.cfop,
        unidade: row.unidade,
        quantidade: row.quantidade,
        unidade_tributavel: row.unidade_tributavel,
        quantidade_tributavel: row.quantidade_tributavel,
        unidades_por_embalagem: row.unidades_por_embalagem,
        valor_unitario: row.valor_unitario,
        valor_total_item: row.valor_total_item,
        valor_desconto_item: row.valor_desconto_item,
        valor_frete_item: row.valor_frete_item,
        valor_outro_item: row.valor_outro_item,
        imposto: {
          cst_icms: row.cst_icms, orig_icms: row.orig_icms,
          base_icms: row.base_icms, perc_icms: row.perc_icms, valor_icms: row.valor_icms,
          base_icms_st: row.base_icms_st, perc_icms_st: row.perc_icms_st, valor_icms_st: row.valor_icms_st,
          cst_ipi: row.cst_ipi, perc_ipi: row.perc_ipi, valor_ipi: row.valor_ipi,
          cst_pis: row.cst_pis, perc_pis: row.perc_pis, valor_pis: row.valor_pis,
          cst_cofins: row.cst_cofins, perc_cofins: row.perc_cofins, valor_cofins: row.valor_cofins,
        },
        custo_unitario_calculado: row.custo_unitario_calculado,
        produto_cadastrado: !!prod,
        produto_id: prod?.id ?? null,
        preco_atual: prod?.preco ?? null,
        preco_sugerido: calcularPrecoSugerido(row.custo_unitario_calculado, MARGEM_PADRAO),
      };
    })
  );

  return { ...nfe, itens };
}

export function listarNfes() {
  return db.prepare(`
    SELECT id, numero, serie, data_emissao, emitente_nome, valor_total, importado_em,
           (SELECT COUNT(*) FROM nfe_itens WHERE nfe_id = nfes.id) AS total_itens
    FROM nfes ORDER BY importado_em DESC
  `).all();
}

export interface AplicarPrecoItem {
  codigo_barras: string | null;
  produto_id: number | null;
  descricao: string;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  unidade: string | null;
  preco_custo: number;
  preco_venda: number;
  /**
   * NÃO enviamos mais isso automaticamente para o Firebird (ver nota abaixo)
   * — mantido no tipo só porque o frontend ainda pode mandar, mas é
   * ignorado por aplicarPrecos.
   */
  situacao_tributaria: string | null;
  /** Unidade tributável (ex.: UN) e quantidade por embalagem, vindas do XML */
  unidade_tributavel?: string | null;
  unidades_por_embalagem?: number | null;
}

/**
 * Aplica os preços/dados da NF-e nos produtos. Virou async porque agora
 * escreve no Firebird. Removida a transação SQLite que envolvia essas
 * chamadas — não faz sentido uma transação SQLite "seguntar" escritas no
 * Firebird (bancos diferentes, sem atomicidade cruzada); cada item é
 * processado sequencialmente e falhas individuais não interrompem os
 * demais, igual comportamento de antes.
 *
 * IMPORTANTE: NÃO mandamos mais item.situacao_tributaria pro Firebird.
 * O código que vem da NF-e nesse campo é o CST/CSOSN do imposto (ex.:
 * "060", "102") — um conceito fiscal diferente da SITUACAOTRIBUTARIAIDO
 * do seu ERP (FK para a tabela SITUACAOTRIBUTARIA, com códigos internos
 * tipo "F00"/"T03"). Mandar o CST direto quebra a FK. Assim que você
 * tiver (ou quiser montar) uma tabela de conversão CST -> SITUACAOTRIBUTARIAIDO,
 * me avise que eu jogo a conversão aqui; até lá, esse campo fica pra
 * revisão manual do operador na tela de produto.
 */
export async function aplicarPrecos(itens: AplicarPrecoItem[]): Promise<{
  atualizados: number;
  criados: number;
  erros: { descricao: string; erro: string }[];
}> {
  let atualizados = 0;
  let criados = 0;
  const erros: { descricao: string; erro: string }[] = [];

  async function definirCustoSePossivel(produtoId: number, precoCusto: number) {
    if (!precoCusto) return;
    try {
      await tabelasPrecosRepository.definirPrecoProduto(produtoId, precoCusto);
    } catch {
      // Não deixa a falha ao gravar custo derrubar a atualização do produto em si.
    }
  }

  for (const item of itens) {
    try {
      const dadosProduto = {
        preco: item.preco_venda,
        ncm: item.ncm ?? undefined,
        cest: item.cest ?? undefined,
        cfop: item.cfop ?? undefined,
        unidade: item.unidade ?? undefined,
        unidade_medida_tributavel: item.unidade_tributavel ?? undefined,
        quantidade_tributavel: item.unidades_por_embalagem ?? undefined,
      };

      if (item.produto_id) {
        await produtosService.atualizar(item.produto_id, dadosProduto);
        await definirCustoSePossivel(item.produto_id, item.preco_custo);
        atualizados++;
      } else if (item.codigo_barras) {
        const existente = await produtosService.buscarPorCodigoBarras(item.codigo_barras);
        if (existente) {
          await produtosService.atualizar(existente.id, dadosProduto);
          await definirCustoSePossivel(existente.id, item.preco_custo);
          atualizados++;
        } else {
          const criado = await produtosService.criar({
            codigo_barras: item.codigo_barras,
            descricao: item.descricao,
            ...dadosProduto,
          });
          await definirCustoSePossivel(criado.id, item.preco_custo);
          criados++;
        }
      }
    } catch (e: any) {
      erros.push({ descricao: item.descricao, erro: e.message });
    }
  }

  return { atualizados, criados, erros };
} 