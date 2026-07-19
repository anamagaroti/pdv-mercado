import db from '../../db/database';
import * as produtosService from '../produtos/produtos.service';
import { obterTabelaOficial, normalizarCodigo, dataEhPassada } from './tabelaOficial.service';
import {
  StatusNcm,
  ResultadoValidacaoNcm,
  EstatisticasValidacaoNcm,
  NcmCacheEntry,
} from '../../types/produto';

const DIAS_CACHE = Number(process.env.NCM_CACHE_DAYS ?? 7);

// ncm_cache continua no SQLite — é só um cache de validação, não é dado do
// produto em si, então não precisa estar no Firebird.
function buscarNoCache(ncm: string): NcmCacheEntry | undefined {
  const linha = db.prepare('SELECT * FROM ncm_cache WHERE ncm = ?').get(ncm);
  return linha as NcmCacheEntry | undefined;
}

function salvarNoCache(entrada: NcmCacheEntry): void {
  db.prepare(
    `INSERT INTO ncm_cache (ncm, status, descricao_oficial, data_inicio_vigencia, data_fim_vigencia, ncm_sugerido, verificado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ncm) DO UPDATE SET
       status = excluded.status,
       descricao_oficial = excluded.descricao_oficial,
       data_inicio_vigencia = excluded.data_inicio_vigencia,
       data_fim_vigencia = excluded.data_fim_vigencia,
       ncm_sugerido = excluded.ncm_sugerido,
       verificado_em = excluded.verificado_em`
  ).run(
    entrada.ncm,
    entrada.status,
    entrada.descricao_oficial,
    entrada.data_inicio_vigencia,
    entrada.data_fim_vigencia,
    entrada.ncm_sugerido,
    entrada.verificado_em
  );
}

function cacheEstaFresco(entrada: NcmCacheEntry): boolean {
  const idadeMs = Date.now() - new Date(entrada.verificado_em).getTime();
  return idadeMs < DIAS_CACHE * 24 * 60 * 60 * 1000;
}

/**
 * Valida um único código NCM contra a tabela oficial (usando cache em banco
 * quando ainda fresco, para evitar consultas repetidas).
 */
async function validarNcmUnico(
  ncmOriginal: string,
  tabelaOficial: Map<string, any>,
  usarCache: boolean
): Promise<NcmCacheEntry> {
  const ncmNormalizado = normalizarCodigo(ncmOriginal);

  if (usarCache) {
    const emCache = buscarNoCache(ncmOriginal);
    if (emCache && cacheEstaFresco(emCache)) {
      return emCache;
    }
  }

  let resultado: NcmCacheEntry;

  if (ncmNormalizado.length !== 8) {
    resultado = {
      ncm: ncmOriginal,
      status: 'invalido',
      descricao_oficial: null,
      data_inicio_vigencia: null,
      data_fim_vigencia: null,
      ncm_sugerido: null,
      verificado_em: new Date().toISOString(),
    };
  } else {
    const item = tabelaOficial.get(ncmNormalizado);
    if (!item) {
      resultado = {
        ncm: ncmOriginal,
        status: 'nao_encontrado',
        descricao_oficial: null,
        data_inicio_vigencia: null,
        data_fim_vigencia: null,
        ncm_sugerido: null,
        verificado_em: new Date().toISOString(),
      };
    } else if (dataEhPassada(item.dataFim)) {
      resultado = {
        ncm: ncmOriginal,
        status: 'invalido',
        descricao_oficial: item.descricao,
        data_inicio_vigencia: item.dataInicio,
        data_fim_vigencia: item.dataFim,
        ncm_sugerido: null,
        verificado_em: new Date().toISOString(),
      };
    } else {
      resultado = {
        ncm: ncmOriginal,
        status: 'valido',
        descricao_oficial: item.descricao,
        data_inicio_vigencia: item.dataInicio,
        data_fim_vigencia: item.dataFim,
        ncm_sugerido: null,
        verificado_em: new Date().toISOString(),
      };
    }
  }

  salvarNoCache(resultado);
  return resultado;
}

export interface ResultadoValidacaoCompleta {
  resultados: ResultadoValidacaoNcm[];
  estatisticas: EstatisticasValidacaoNcm;
}

/**
 * Lê TODOS os produtos do Firebird, separa os NCMs únicos (evitando
 * consultas repetidas) e valida cada um contra a tabela oficial.
 */
export async function validarTodosOsNcms(
  opcoes: { forcarAtualizacaoTabela?: boolean; ignorarCache?: boolean } = {}
): Promise<ResultadoValidacaoCompleta> {
  const inicio = Date.now();

  const tabelaOficial = await obterTabelaOficial(opcoes.forcarAtualizacaoTabela);
  const produtos = await produtosService.listarTodosParaValidacaoNcm();

  const ncmsUnicos = Array.from(
    new Set(
      produtos
        .map((p) => p.ncm)
        .filter((ncm): ncm is string => !!ncm && ncm.trim() !== '')
        .map((ncm) => ncm.trim())
    )
  );

  const cacheValidacao = new Map<string, NcmCacheEntry>();
  for (const ncm of ncmsUnicos) {
    const validado = await validarNcmUnico(ncm, tabelaOficial, !opcoes.ignorarCache);
    cacheValidacao.set(ncm, validado);
  }

  const resultados: ResultadoValidacaoNcm[] = produtos.map((produto) => {
    if (!produto.ncm || produto.ncm.trim() === '') {
      return {
        produto_id: produto.id,
        descricao: produto.descricao,
        codigo_barras: produto.codigo_barras,
        ncm: null,
        status: 'sem_ncm' as StatusNcm,
      };
    }
    const validado = cacheValidacao.get(produto.ncm.trim())!;
    return {
      produto_id: produto.id,
      descricao: produto.descricao,
      codigo_barras: produto.codigo_barras,
      ncm: produto.ncm,
      status: validado.status,
      descricao_oficial: validado.descricao_oficial,
      ncm_sugerido: validado.ncm_sugerido,
    };
  });

  const estatisticas: EstatisticasValidacaoNcm = {
    total_produtos: produtos.length,
    total_validos: resultados.filter((r) => r.status === 'valido').length,
    total_invalidos: resultados.filter((r) => r.status === 'invalido').length,
    total_nao_encontrados: resultados.filter((r) => r.status === 'nao_encontrado').length,
    total_sem_ncm: resultados.filter((r) => r.status === 'sem_ncm').length,
    ncms_unicos_verificados: ncmsUnicos.length,
    tempo_ms: Date.now() - inicio,
    verificado_em: new Date().toISOString(),
  };

  return { resultados, estatisticas };
}

export async function obterUltimaValidacaoSalva(): Promise<ResultadoValidacaoNcm[]> {
  const produtos = await produtosService.listarTodosParaValidacaoNcm();
  return produtos.map((produto) => {
    if (!produto.ncm || produto.ncm.trim() === '') {
      return {
        produto_id: produto.id,
        descricao: produto.descricao,
        codigo_barras: produto.codigo_barras,
        ncm: null,
        status: 'sem_ncm' as StatusNcm,
      };
    }
    const emCache = buscarNoCache(produto.ncm.trim());
    return {
      produto_id: produto.id,
      descricao: produto.descricao,
      codigo_barras: produto.codigo_barras,
      ncm: produto.ncm,
      status: emCache ? emCache.status : ('nao_encontrado' as StatusNcm),
      descricao_oficial: emCache?.descricao_oficial,
      ncm_sugerido: emCache?.ncm_sugerido,
    };
  });
}