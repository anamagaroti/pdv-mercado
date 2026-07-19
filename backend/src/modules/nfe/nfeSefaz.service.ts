import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { SEFAZ_ENDPOINT } from './nfeChave.service';
import { criarAgenteCertificado } from './certificado.service';

export interface ResultadoConsultaSefaz {
  sucesso: boolean;
  xmlNfe?: string;
  cStat?: string;
  xMotivo?: string;
  erro?: string;
  requerCertificado?: boolean;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

function buildSoapEnvelope(cUF: string, chave: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><cUF>${cUF}</cUF><versaoDados>4.00</versaoDados></nfeCabecMsg></soap:Header><soap:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>1</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe></nfeDadosMsg></soap:Body></soap:Envelope>`;
}

/**
 * Consulta a NF-e no SEFAZ do estado emissor usando o certificado digital A1.
 * Requer certificado configurado — sem ele, retorna `requerCertificado: true`.
 */
export async function consultarNfeSefaz(
  chave: string,
  cUF: string
): Promise<ResultadoConsultaSefaz> {
  const agente = criarAgenteCertificado();
  if (!agente) {
    return {
      sucesso: false,
      requerCertificado: true,
      erro: 'Certificado digital não configurado. Acesse Configurações > Certificado Digital para cadastrá-lo.',
    };
  }

  const url = SEFAZ_ENDPOINT[cUF];
  if (!url) {
    return {
      sucesso: false,
      erro: `Endpoint SEFAZ não mapeado para o estado ${cUF}. Importe o XML manualmente.`,
    };
  }

  try {
    const soapBody = buildSoapEnvelope(cUF, chave);
    const soapAction = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF';

    const resposta = await axios.post(url, soapBody, {
      httpsAgent: agente,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
      },
      timeout: 30_000,
    });

    const parsed = xmlParser.parse(resposta.data);

    const envelope =
      parsed['soap:Envelope'] ?? parsed['soap12:Envelope'] ?? parsed['Envelope'] ?? {};
    const body = envelope['soap:Body'] ?? envelope['soap12:Body'] ?? envelope['Body'] ?? {};
    const nfeResult = body['nfeConsultaNFResult'] ?? body['nfeConsultaNFNFResult'] ?? body;
    const retMsg = nfeResult['nfeResultMsg'] ?? nfeResult;
    const ret = retMsg['retConsSitNFe'] ?? retMsg;

    const cStat = String(ret?.cStat ?? '');
    const xMotivo = String(ret?.xMotivo ?? '');

    if (cStat === '100') {
  return { sucesso: true, xmlNfe: resposta.data, cStat, xMotivo };
}

    return {
      sucesso: false,
      cStat,
      xMotivo,
      erro: `SEFAZ retornou status ${cStat}: ${xMotivo}`,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    if (status === 403 || status === 401) {
      return {
        sucesso: false,
        requerCertificado: true,
        erro: 'SEFAZ recusou a conexão (403/401). Verifique se o certificado digital está correto e dentro da validade.',
      };
    }
    return {
      sucesso: false,
      erro: `Erro ao consultar SEFAZ: ${e.message}`,
    };
  }
}
