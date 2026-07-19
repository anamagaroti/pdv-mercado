/**
 * Decodificador da chave de acesso da NF-e.
 *
 * Estrutura da chave (44 dígitos):
 *   cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */

export interface ChaveDecodificada {
  chave: string;
  valida: boolean;
  erro?: string;
  cUF: string;
  uf: string;
  ufNome: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: '55' | '65' | string;
  modeloDescricao: string;
  serie: string;
  numero: string;
  tpEmis: string;
  cNF: string;
  cDV: string;
  urlConsultaPortal: string;
}

const UF_MAP: Record<string, [string, string]> = {
  '11': ['RO', 'Rondônia'],     '12': ['AC', 'Acre'],
  '13': ['AM', 'Amazonas'],     '14': ['RR', 'Roraima'],
  '15': ['PA', 'Pará'],         '16': ['AP', 'Amapá'],
  '17': ['TO', 'Tocantins'],    '21': ['MA', 'Maranhão'],
  '22': ['PI', 'Piauí'],        '23': ['CE', 'Ceará'],
  '24': ['RN', 'Rio Grande do Norte'], '25': ['PB', 'Paraíba'],
  '26': ['PE', 'Pernambuco'],   '27': ['AL', 'Alagoas'],
  '28': ['SE', 'Sergipe'],      '29': ['BA', 'Bahia'],
  '31': ['MG', 'Minas Gerais'], '32': ['ES', 'Espírito Santo'],
  '33': ['RJ', 'Rio de Janeiro'], '35': ['SP', 'São Paulo'],
  '41': ['PR', 'Paraná'],       '42': ['SC', 'Santa Catarina'],
  '43': ['RS', 'Rio Grande do Sul'], '50': ['MS', 'Mato Grosso do Sul'],
  '51': ['MT', 'Mato Grosso'],  '52': ['GO', 'Goiás'],
  '53': ['DF', 'Distrito Federal'],
};

/** URLs do webservice NFeConsultaProtocolo4 de produção, por cUF */
export const SEFAZ_ENDPOINT: Record<string, string> = {
  '35': 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
  '31': 'https://nfe.fazenda.mg.gov.br/nfe/services/NFeConsultaProtocolo4',
  '43': 'https://nfe.sefaz.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '41': 'https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4',
  '29': 'https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  '52': 'https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4',
  '13': 'https://nfe.sefaz.am.gov.br/services/NfeConsulta4',
  '51': 'https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4',
  '50': 'https://nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4',
  '21': 'https://nfe.sefaz.ma.gov.br/nfe4/services/NFeConsultaProtocolo4',
  '26': 'https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4',
  // SVRS (Virtual RS) — AC, AL, AP, DF, ES, PB, RJ, RN, RO, RR, SC, SE, TO
  '12': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '27': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '16': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '53': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '32': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '25': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '33': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '24': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '11': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '14': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '42': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '28': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  '17': 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
  // SVC-AN — CE, PA, PI
  '23': 'https://www.svc.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  '15': 'https://www.svc.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
  '22': 'https://www.svc.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
};

export function decodificarChave(chaveRaw: string): ChaveDecodificada {
  // Remove tudo que não é dígito (espaços, pontos, etc.)
  const chave = chaveRaw.replace(/\D/g, '');

  if (chave.length !== 44) {
    return {
      chave, valida: false,
      erro: `Chave deve ter 44 dígitos, recebeu ${chave.length}.`,
      cUF: '', uf: '', ufNome: '', anoMes: '', cnpjEmitente: '',
      modelo: '', modeloDescricao: '', serie: '', numero: '',
      tpEmis: '', cNF: '', cDV: '', urlConsultaPortal: '',
    };
  }

  const cUF = chave.slice(0, 2);
  const ufInfo = UF_MAP[cUF];
  if (!ufInfo) {
    return {
      chave, valida: false, erro: `Código UF "${cUF}" desconhecido.`,
      cUF, uf: '', ufNome: '', anoMes: '', cnpjEmitente: '',
      modelo: '', modeloDescricao: '', serie: '', numero: '',
      tpEmis: '', cNF: '', cDV: '', urlConsultaPortal: '',
    };
  }

  const anoMes = chave.slice(2, 6);
  const cnpj = chave.slice(6, 20);
  const modelo = chave.slice(20, 22);
  const serie = chave.slice(22, 25);
  const numero = chave.slice(25, 34).replace(/^0+/, '') || '0';
  const tpEmis = chave.slice(34, 35);
  const cNF = chave.slice(35, 43);
  const cDV = chave.slice(43, 44);

  const urlPortal = `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=7PhJ+gAVw2g=&nfe=${chave}`;

  return {
    chave,
    valida: true,
    cUF,
    uf: ufInfo[0],
    ufNome: ufInfo[1],
    anoMes: `${anoMes.slice(2, 4)}/${anoMes.slice(0, 2)}`, // MM/AA → AA/MM
    cnpjEmitente: cnpj,
    modelo,
    modeloDescricao: modelo === '55' ? 'NF-e' : modelo === '65' ? 'NFC-e' : `Modelo ${modelo}`,
    serie,
    numero,
    tpEmis,
    cNF,
    cDV,
    urlConsultaPortal: urlPortal,
  };
}

/** Encontra a primeira chave de acesso válida em um texto livre */
export function extrairChaveDeTexto(texto: string): string | null {
  // Tenta chave contínua (44 dígitos seguidos)
  const matchContinuo = texto.match(/\b(\d{44})\b/);
  if (matchContinuo) return matchContinuo[1];

  // Tenta chave com espaços a cada 4 dígitos (formato DANFE antigo)
  const matchEspacos = texto.match(/(\d{4}\s){10}\d{4}/);
  if (matchEspacos) return matchEspacos[0].replace(/\s/g, '');

  // Tenta grupos de dígitos separados por espaço ou ponto que totalizam 44
  const blocos = texto.match(/\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b[\s.]\b\d{4}\b/);
  if (blocos) return blocos[0].replace(/[\s.]/g, '');

  return null;
}
