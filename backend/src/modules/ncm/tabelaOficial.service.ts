import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Fonte oficial e gratuita: Portal Único de Comércio Exterior (Siscomex),
 * mantido pela Receita Federal. Não exige token nem cadastro.
 *
 * Endpoint confirmado publicamente (inclusive usado em tutoriais oficiais
 * e bibliotecas open-source de consulta de NCM):
 *   https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO
 *
 * IMPORTANTE: a própria Receita Federal documenta que esse arquivo traz
 * apenas a tabela VIGENTE — não inclui códigos antigos/removidos. Por isso
 * o validador trata "não encontrado na tabela" como um status diferente de
 * "inválido": pode significar que o código nunca existiu, ou que existiu e
 * foi descontinuado — não há como diferenciar via fonte gratuita, então o
 * sistema sinaliza isso ao invés de afirmar categoricamente que é inválido.
 */
const URL_TABELA_OFICIAL =
  'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO';

const CAMINHO_CACHE_LOCAL = path.join(__dirname, '..', '..', '..', 'data', 'ncm-tabela-oficial.json');
const DIAS_CACHE = Number(process.env.NCM_CACHE_DAYS ?? 7);

export interface ItemTabelaNcm {
  codigo: string; // normalizado, somente dígitos (ex: "17019900")
  descricao: string;
  dataInicio: string | null;
  dataFim: string | null;
}

interface CacheTabelaNcm {
  baixadoEm: string;
  itens: ItemTabelaNcm[];
}

let memoria: { mapa: Map<string, ItemTabelaNcm>; baixadoEm: string } | null = null;

function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\D/g, '');
}

function cacheLocalValido(cache: CacheTabelaNcm): boolean {
  const idadeMs = Date.now() - new Date(cache.baixadoEm).getTime();
  return idadeMs < DIAS_CACHE * 24 * 60 * 60 * 1000;
}

// Headers necessários para o Portal Siscomex não rejeitar a requisição com 403.
// O portal exige que a chamada pareça vir de um navegador.
const HEADERS_SISCOMEX = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'https://portalunico.siscomex.gov.br/',
  Origin: 'https://portalunico.siscomex.gov.br',
};

async function baixarDaFonteOficial(): Promise<ItemTabelaNcm[]> {
  const resposta = await axios.get(URL_TABELA_OFICIAL, {
    timeout: 30_000,
    headers: HEADERS_SISCOMEX,
  });
  const nomenclaturas = resposta.data?.Nomenclaturas ?? [];

  return nomenclaturas
  .map((n: any) => ({
    codigo: normalizarCodigo(String(n.Codigo ?? '')),
    descricao: n.Descricao ?? '',
    dataInicio: n.Data_Inicio ?? null,
    dataFim: n.Data_Fim ?? null,
  }))
  .filter((item: ItemTabelaNcm) => item.codigo.length > 0);
}

/**
 * Retorna a tabela oficial de NCM como um mapa (código -> item), usando
 * cache em arquivo para evitar baixar ~20 mil registros a cada validação.
 */
export async function obterTabelaOficial(
  forcarAtualizacao = false
): Promise<Map<string, ItemTabelaNcm>> {
  if (!forcarAtualizacao && memoria) {
    return memoria.mapa;
  }

  if (!forcarAtualizacao && fs.existsSync(CAMINHO_CACHE_LOCAL)) {
    try {
      const cache: CacheTabelaNcm = JSON.parse(fs.readFileSync(CAMINHO_CACHE_LOCAL, 'utf-8'));
      if (cacheLocalValido(cache)) {
        const mapa = new Map(cache.itens.map((i) => [i.codigo, i]));
        memoria = { mapa, baixadoEm: cache.baixadoEm };
        return mapa;
      }
    } catch {
      // cache corrompido — ignora e baixa novamente
    }
  }

  const itens = await baixarDaFonteOficial();
  const baixadoEm = new Date().toISOString();

  const dirCache = path.dirname(CAMINHO_CACHE_LOCAL);
  if (!fs.existsSync(dirCache)) fs.mkdirSync(dirCache, { recursive: true });
  fs.writeFileSync(CAMINHO_CACHE_LOCAL, JSON.stringify({ baixadoEm, itens }));

  const mapa = new Map(itens.map((i) => [i.codigo, i]));
  memoria = { mapa, baixadoEm };
  return mapa;
}

export function dataEhPassada(dataIso: string | null): boolean {
  if (!dataIso) return false;
  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return false;
  return data.getTime() < Date.now();
}

export { normalizarCodigo };
