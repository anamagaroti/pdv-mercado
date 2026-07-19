import { XMLParser } from 'fast-xml-parser';

export interface NfeTotais {
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
}

export interface NfeImpostoItem {
  // ICMS
  cst_icms: string | null;
  orig_icms: string | null;
  base_icms: number;
  perc_icms: number;
  valor_icms: number;
  // ICMS-ST
  base_icms_st: number;
  perc_icms_st: number;
  valor_icms_st: number;
  // IPI
  cst_ipi: string | null;
  perc_ipi: number;
  valor_ipi: number;
  // PIS
  cst_pis: string | null;
  perc_pis: number;
  valor_pis: number;
  // COFINS
  cst_cofins: string | null;
  perc_cofins: number;
  valor_cofins: number;
}

export interface NfeItem {
  numero_item: number;
  codigo_fornecedor: string | null;
  codigo_barras: string | null;
  descricao: string;
  ncm: string | null;
  cest: string | null; 
  cfop: string | null;
  unidade: string | null; // unidade comercial (uCom) — ex.: CX, PC
  quantidade: number; // quantidade comercial (qCom)
  unidade_tributavel: string | null; // unidade tributável (uTrib) — ex.: UN
  quantidade_tributavel: number; // quantidade tributável (qTrib)
  /**
   * Quantas unidades tributáveis tem em 1 unidade comercial (ex.: 12 latas
   * por caixa). null quando não dá pra calcular (quantidade comercial = 0)
   * ou quando a nota não distingue unidade comercial de tributável.
   */
  unidades_por_embalagem: number | null;
  valor_unitario: number;
  valor_total_item: number;
  valor_desconto_item: number;
  valor_frete_item: number;
  valor_outro_item: number;
  imposto: NfeImpostoItem;
  /** Custo unitário calculado: vUnit + IPI/unit + frete_proporcional/unit + ST/unit */
  custo_unitario_calculado: number;
}

export interface NfeParsed {
  chave_acesso: string | null;
  numero: string | null;
  serie: string | null;
  data_emissao: string | null;
  natureza_operacao: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  emitente_ie: string | null;
  emitente_uf: string | null;
  totais: NfeTotais;
  itens: NfeItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'det',
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

function num(v: any): number {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : n;
}

function str(v: any): string | null {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  return s === '' || s.toLowerCase() === 'sem gtin' || s === 'SEM GTIN' ? null : s;
}

/** Extrai dados do ICMS independente do grupo (ICMS00, ICMS10, ICMS20…) */
function extrairIcms(icmsNode: any): Pick<NfeImpostoItem, 'cst_icms' | 'orig_icms' | 'base_icms' | 'perc_icms' | 'valor_icms' | 'base_icms_st' | 'perc_icms_st' | 'valor_icms_st'> {
  if (!icmsNode) return { cst_icms: null, orig_icms: null, base_icms: 0, perc_icms: 0, valor_icms: 0, base_icms_st: 0, perc_icms_st: 0, valor_icms_st: 0 };

  // Tenta todas as variantes possíveis de grupo ICMS
  const grupos = ['ICMS00','ICMS10','ICMS20','ICMS30','ICMS40','ICMS41','ICMS50','ICMS51','ICMS60','ICMS70','ICMS90','ICMSPart','ICMSST','ICMSSNn'];
  let g: any = null;
  for (const nome of grupos) {
    if (icmsNode[nome]) { g = icmsNode[nome]; break; }
  }
  if (!g) return { cst_icms: null, orig_icms: null, base_icms: 0, perc_icms: 0, valor_icms: 0, base_icms_st: 0, perc_icms_st: 0, valor_icms_st: 0 };

  return {
    cst_icms: str(g.CST ?? g.CSOSN),
    orig_icms: str(g.orig),
    base_icms: num(g.vBC),
    perc_icms: num(g.pICMS),
    valor_icms: num(g.vICMS),
    base_icms_st: num(g.vBCST),
    perc_icms_st: num(g.pICMSST),
    valor_icms_st: num(g.vICMSST),
  };
}

function extrairIpi(ipiNode: any): Pick<NfeImpostoItem, 'cst_ipi' | 'perc_ipi' | 'valor_ipi'> {
  if (!ipiNode) return { cst_ipi: null, perc_ipi: 0, valor_ipi: 0 };
  const g = ipiNode.IPITrib ?? ipiNode.IPINT ?? ipiNode;
  return {
    cst_ipi: str(g.CST),
    perc_ipi: num(g.pIPI),
    valor_ipi: num(g.vIPI),
  };
}

function extrairPis(pisNode: any): Pick<NfeImpostoItem, 'cst_pis' | 'perc_pis' | 'valor_pis'> {
  if (!pisNode) return { cst_pis: null, perc_pis: 0, valor_pis: 0 };
  const g = pisNode.PISAliq ?? pisNode.PISNT ?? pisNode.PISQtde ?? pisNode.PISOutr ?? pisNode;
  return {
    cst_pis: str(g.CST),
    perc_pis: num(g.pPIS),
    valor_pis: num(g.vPIS),
  };
}

function extrairCofins(cofinsNode: any): Pick<NfeImpostoItem, 'cst_cofins' | 'perc_cofins' | 'valor_cofins'> {
  if (!cofinsNode) return { cst_cofins: null, perc_cofins: 0, valor_cofins: 0 };
  const g = cofinsNode.COFINSAliq ?? cofinsNode.COFINSNT ?? cofinsNode.COFINSQtde ?? cofinsNode.COFINSOutr ?? cofinsNode;
  return {
    cst_cofins: str(g.CST),
    perc_cofins: num(g.pCOFINS),
    valor_cofins: num(g.vCOFINS),
  };
}

export function parseNfeXml(xmlBuffer: Buffer): NfeParsed {
  const xml = parser.parse(xmlBuffer.toString('utf-8'));

  // Suporta NFe embrulhada em nfeProc ou nfe ou NFe diretamente
  const root = xml.nfeProc ?? xml.nfe ?? xml.NFe ?? xml;
  const nfe = root.NFe ?? root;
  const inf = nfe.infNFe ?? nfe;

  const ide = inf.ide ?? {};
  const emit = inf.emit ?? {};
  const endEmit = emit.enderEmit ?? {};
  const totais = inf.total?.ICMSTot ?? {};
  const dets: any[] = Array.isArray(inf.det) ? inf.det : inf.det ? [inf.det] : [];

  // Chave de acesso: atributo Id sem o prefixo "NFe"
  const chaveRaw = str(inf['@_Id'] ?? inf.infNFe?.['@_Id']);
  const chave = chaveRaw ? chaveRaw.replace(/^NFe/, '') : null;

  const totalParsed: NfeTotais = {
    valor_produtos: num(totais.vProd),
    valor_frete: num(totais.vFrete),
    valor_seguro: num(totais.vSeg),
    valor_desconto: num(totais.vDesc),
    valor_ipi: num(totais.vIPI),
    valor_icms: num(totais.vICMS),
    valor_icms_st: num(totais.vICMSST),
    valor_pis: num(totais.vPIS),
    valor_cofins: num(totais.vCOFINS),
    valor_outro: num(totais.vOutro),
    valor_total: num(totais.vNF),
  };

  const itens: NfeItem[] = dets.map((det, idx) => {
    const prod = det.prod ?? {};
    const imp = det.imposto ?? {};

    const icms = extrairIcms(imp.ICMS);
    const ipi = extrairIpi(imp.IPI);
    const pis = extrairPis(imp.PIS);
    const cofins = extrairCofins(imp.COFINS);
    const quantidade = num(prod.qCom ?? prod.qTrib);
    const valorUnitario = num(prod.vUnCom ?? prod.vUnTrib);
    const valorTotalItem = num(prod.vProd);
    const valorDescontoItem = num(prod.vDesc);
    const valorFreteItem = num(prod.vFrete);
    const valorOutroItem = num(prod.vOutro);

    const unidadeComercial = str(prod.uCom);
    const quantidadeTributavel = num(prod.qTrib ?? prod.qCom);
    const unidadeTributavel = str(prod.uTrib) ?? unidadeComercial;

    // Só calcula quando a nota realmente preencheu os DOIS campos de
    // quantidade (qCom e qTrib) — se só um deles existir, os dois acabam
    // caindo no mesmo valor (fallback) e a proporção não significa nada.
    // Quando os dois existem, usa a proporção das quantidades — não importa
    // se o texto da unidade comercial bate com o da tributável ou não.
    const notaTrouxeAmbasQuantidades =
      prod.qCom !== undefined && prod.qCom !== null && prod.qCom !== '' &&
      prod.qTrib !== undefined && prod.qTrib !== null && prod.qTrib !== '';
    const unidadesPorEmbalagem =
      notaTrouxeAmbasQuantidades && quantidade > 0 && quantidadeTributavel > 0
        ? Math.round((quantidadeTributavel / quantidade) * 10000) / 10000
        : null;

    // Frete proporcional ao item (caso não venha explícito no item)
    let freteProporcional = valorFreteItem;
    if (freteProporcional === 0 && totalParsed.valor_produtos > 0 && totalParsed.valor_frete > 0) {
      freteProporcional = (valorTotalItem / totalParsed.valor_produtos) * totalParsed.valor_frete;
    }

    // Custo unitário real = preço unitário + IPI/unit + frete_proporcional/unit + ST/unit
    const ipiUnitario = quantidade > 0 ? ipi.valor_ipi / quantidade : 0;
    const pisUnitario = quantidade > 0 ? pis.valor_pis / quantidade : 0;
    const confinsUnitario = quantidade > 0 ? cofins.valor_cofins / quantidade : 0;
    const freteUnitario = quantidade > 0 ? freteProporcional / quantidade : 0;
    const stUnitario = quantidade > 0 ? icms.valor_icms / quantidade : 0;
    const descontoUnitario = quantidade > 0 ? valorDescontoItem / quantidade : 0;
    const custoUnitario = valorUnitario + ipiUnitario + pisUnitario + confinsUnitario + freteUnitario + stUnitario - descontoUnitario;

    // Código de barras: prefere cEAN, fallback para cEANTrib
    const ean = str(prod.cEAN) ?? str(prod.cEANTrib);

    return {
      numero_item: num(det['@_nItem'] ?? idx + 1),
      codigo_fornecedor: str(prod.cProd),
      codigo_barras: ean,
      descricao: String(prod.xProd ?? '').trim(),
      ncm: str(prod.NCM),
      cest: str(prod.CEST),
      cfop: str(prod.CFOP),
      unidade: unidadeComercial ?? str(prod.uTrib),
      quantidade,
      unidade_tributavel: unidadeTributavel,
      quantidade_tributavel: quantidadeTributavel,
      unidades_por_embalagem: unidadesPorEmbalagem,
      valor_unitario: valorUnitario,
      valor_total_item: valorTotalItem,
      valor_desconto_item: valorDescontoItem,
      valor_frete_item: freteProporcional,
      valor_outro_item: valorOutroItem,
      imposto: { ...icms, ...ipi, ...pis, ...cofins },
      custo_unitario_calculado: Math.round(custoUnitario * 100000) / 100000,
    };
  });

  return {
    chave_acesso: chave,
    numero: str(ide.nNF),
    serie: str(ide.serie),
    data_emissao: str(ide.dhEmi ?? ide.dEmi),
    natureza_operacao: str(ide.natOp),
    emitente_cnpj: str(emit.CNPJ),
    emitente_nome: str(emit.xNome ?? emit.xFant),
    emitente_ie: str(emit.IE),
    emitente_uf: str(endEmit.UF),
    totais: totalParsed,
    itens,
  };
}