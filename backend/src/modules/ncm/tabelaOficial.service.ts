import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { StatusNcm } from '../../types/produto';
import { SugestaoNcm } from './siscomexBusca.service';

/**
 * Fonte oficial e gratuita: Portal Único de Comércio Exterior (Siscomex).
 */
const URL_TABELA_OFICIAL =
  'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO';

const CAMINHO_CACHE_LOCAL = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'data',
  'ncm-tabela-oficial.json'
);

const DIAS_CACHE = Number(process.env.NCM_CACHE_DAYS ?? 7);

/**
 * Sempre que alterarmos a estrutura armazenada no cache,
 * aumentamos essa versão para obrigar a reconstrução.
 */
const VERSAO_CACHE = 2;

export interface ItemTabelaNcm {
  /**
   * Código normalizado, somente dígitos.
   *
   * Exemplos:
   * 07       -> 07
   * 0713     -> 0713
   * 07133    -> 07133
   * 071333   -> 071333
   * 07133319 -> 07133319
   */
  codigo: string;

  descricao: string;

  dataInicio: string | null;
  dataFim: string | null;
}

interface CacheTabelaNcm {
  versao: number;
  baixadoEm: string;
  itens: ItemTabelaNcm[];
}

let memoria: {
  mapa: Map<string, ItemTabelaNcm>;
  baixadoEm: string;
} | null = null;

function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\D/g, '');
}

function cacheLocalValido(cache: CacheTabelaNcm): boolean {
  if (cache.versao !== VERSAO_CACHE) {
    return false;
  }

  const idadeMs =
    Date.now() - new Date(cache.baixadoEm).getTime();

  return idadeMs < DIAS_CACHE * 24 * 60 * 60 * 1000;
}

const HEADERS_SISCOMEX = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

  Accept: 'application/json, text/plain, */*',

  'Accept-Language':
    'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',

  Referer:
    'https://portalunico.siscomex.gov.br/',

  Origin:
    'https://portalunico.siscomex.gov.br',
};

async function baixarDaFonteOficial(): Promise<ItemTabelaNcm[]> {
  const resposta = await axios.get(URL_TABELA_OFICIAL, {
    timeout: 30_000,
    headers: HEADERS_SISCOMEX,
  });

  const nomenclaturas =
    resposta.data?.Nomenclaturas ?? [];

  return nomenclaturas
    .map((n: any) => ({
      codigo: normalizarCodigo(String(n.Codigo ?? '')),
      descricao: String(n.Descricao ?? '').trim(),
      dataInicio: n.Data_Inicio ?? null,
      dataFim: n.Data_Fim ?? null,
    }))
    .filter(
      (item: ItemTabelaNcm) =>
        item.codigo.length > 0 &&
        item.descricao.length > 0
    );
}

export async function obterTabelaOficial(
  forcarAtualizacao = false
): Promise<Map<string, ItemTabelaNcm>> {
  if (!forcarAtualizacao && memoria) {
    return memoria.mapa;
  }

  if (
    !forcarAtualizacao &&
    fs.existsSync(CAMINHO_CACHE_LOCAL)
  ) {
    try {
      const cache: CacheTabelaNcm = JSON.parse(
        fs.readFileSync(
          CAMINHO_CACHE_LOCAL,
          'utf-8'
        )
      );

      if (cacheLocalValido(cache)) {
        const mapa = new Map(
          cache.itens.map((i) => [
            i.codigo,
            i,
          ])
        );

        memoria = {
          mapa,
          baixadoEm: cache.baixadoEm,
        };

        return mapa;
      }
    } catch {
      // Cache corrompido ou incompatível.
      // Será baixado novamente.
    }
  }

  const itens = await baixarDaFonteOficial();

  const baixadoEm = new Date().toISOString();

  const dirCache = path.dirname(
    CAMINHO_CACHE_LOCAL
  );

  if (!fs.existsSync(dirCache)) {
    fs.mkdirSync(dirCache, {
      recursive: true,
    });
  }

  fs.writeFileSync(
    CAMINHO_CACHE_LOCAL,
    JSON.stringify(
      {
        versao: VERSAO_CACHE,
        baixadoEm,
        itens,
      },
      null,
      2
    )
  );

  const mapa = new Map(
    itens.map((i) => [
      i.codigo,
      i,
    ])
  );

  memoria = {
    mapa,
    baixadoEm,
  };

  return mapa;
}

export function dataEhPassada(
  dataIso: string | null
): boolean {
  if (!dataIso) return false;

  const data = new Date(dataIso);

  if (isNaN(data.getTime())) {
    return false;
  }

  return data.getTime() < Date.now();
}

export {
  normalizarCodigo,
};

export interface GrupoNcmProblematico {
  ncm_atual: string | null;

  status: Extract<
    StatusNcm,
    'invalido' | 'nao_encontrado'
  >;

  descricao_ncm_antigo: string | null;

  produtos_afetados: {
    produto_id: number;
    descricao: string;
    codigo_barras: string | null;
  }[];

  texto_busca: string;

  sugestoes: SugestaoNcm[];

  melhor_indice: number;
}