import axios from 'axios';
import zlib from 'zlib';

import { XMLParser } from 'fast-xml-parser';
import { criarAgenteCertificado } from './certificado.service';

/** Serviço nacional único — não muda por UF */
const URL_DISTRIBUICAO_DFE = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';

export interface ResultadoDistribuicaoDFe {
  sucesso: boolean;
  cStat?: string;
  xMotivo?: string;
  /** XML completo da NF-e (procNFe/nfeProc), já descompactado, pronto pro parseNfeXml/importarNfe */
  xmlNfeCompleto?: Buffer;
  erro?: string;
  requerCertificado?: boolean;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
});

/**
 * Monta o envelope SOAP 1.2 para consulta por chave de acesso (consChNFe).
 * IMPORTANTE:
 *  - Esse serviço NÃO usa nfeCabecMsg (sem header) — diferente da consulta de protocolo.
 *  - O elemento <nfeDistDFeInteresse> PRECISA envolver o <nfeDadosMsg> (oposto do
 *    que vimos no NFeConsultaProtocolo4 — cada serviço tem seu próprio contrato).
 *  - Tudo em uma linha só, sem espaços/quebras entre tags (a SEFAZ rejeita
 *    caracteres de edição — mesmo bug que já pegamos na consulta protocolo).
 */
function buildDistDFeEnvelope(cnpjInteressado: string, cUFAutor: string, chave: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>1</tpAmb><cUFAutor>${cUFAutor}</cUFAutor><CNPJ>${cnpjInteressado}</CNPJ><consChNFe><chNFe>${chave}</chNFe></consChNFe></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap:Body></soap:Envelope>`;
}

/**
 * Consulta e baixa o XML completo de uma NF-e via Distribuição DFe.
 * Só funciona para notas em que o CNPJ do certificado é destinatário,
 * emitente ou transportador — e só para documentos dos últimos 90 dias
 * recebidos pelo Ambiente Nacional.
 */
export async function consultarDistribuicaoDFe(
  chave: string,
  cUFAutor: string,
  cnpjInteressado: string
): Promise<ResultadoDistribuicaoDFe> {
  const agente = criarAgenteCertificado();
  if (!agente) {
    return {
      sucesso: false,
      requerCertificado: true,
      erro: 'Certificado digital não configurado.',
    };
  }

  try {
    const soapBody = buildDistDFeEnvelope(cnpjInteressado, cUFAutor, chave);
    const resposta = await axios.post(URL_DISTRIBUICAO_DFE, soapBody, {
      httpsAgent: agente,
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`,
      },
      timeout: 30_000,
    });

    const parsed = xmlParser.parse(resposta.data);
    const envelope = parsed['soap:Envelope'] ?? parsed['Envelope'] ?? {};
    const body = envelope['soap:Body'] ?? envelope['Body'] ?? {};
    const responseMsg = body['nfeDistDFeInteresseResponse'] ?? body;
    const resultMsg = responseMsg['nfeDistDFeInteresseResult'] ?? responseMsg;
    const ret = resultMsg['retDistDFeInt'] ?? resultMsg;

    const cStat = String(ret?.cStat ?? '');
    const xMotivo = String(ret?.xMotivo ?? '');

    // 138 = Documento localizado. 137 = Nenhum documento localizado.
    if (cStat !== '138') {
      return { sucesso: false, cStat, xMotivo, erro: `SEFAZ retornou ${cStat}: ${xMotivo}` };
    }

    const docZipBase64 = ret?.loteDistDFeInt?.docZip;
    const docZipTexto = typeof docZipBase64 === 'object' ? docZipBase64['#text'] : docZipBase64;

    if (!docZipTexto) {
      return { sucesso: false, cStat, xMotivo, erro: 'cStat 138 mas nenhum docZip veio na resposta.' };
    }

    // docZip vem em base64 + gzip — precisa descompactar pra virar o XML de verdade
    const xmlNfeCompleto = zlib.gunzipSync(Buffer.from(docZipTexto, 'base64'));

    return { sucesso: true, cStat, xMotivo, xmlNfeCompleto };
  } catch (e: any) {
    return { sucesso: false, erro: `Erro ao consultar Distribuição DFe: ${e.message}` };
  }
}