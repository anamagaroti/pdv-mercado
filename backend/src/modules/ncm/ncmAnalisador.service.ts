import * as produtosService from '../produtos/produtos.service';
import { obterTabelaOficial, normalizarCodigo } from './tabelaOficial.service';
import {
  buscarSubstitutosHierarquicos,
  buscarPorTextoFallback,
  SugestaoNcm,
} from './siscomexBusca.service';
import { StatusNcm } from '../../types/produto';

export interface GrupoNcmProblematico {
  ncm_atual: string | null;
  status: Extract<StatusNcm, 'invalido' | 'nao_encontrado'>;
  descricao_ncm_antigo: string | null;
  produtos_afetados: {
    produto_id: number;
    descricao: string;
    codigo_barras: string | null;
  }[];
  texto_busca: string;
  sugestoes: SugestaoNcm[];
  /** Índice dentro de `sugestoes` da melhor sugestão para pré-selecionar */
  melhor_indice: number;
}

export interface CorrecaoNcm {
  produto_ids: number[];
  ncm_novo: string;
}

// ── Utilitários de similaridade ───────────────────────────────────────────

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'de','do','da','dos','das','e','em','com','para','por','no','na','nos',
  'nas','um','uma','kg','g','ml','l','un','und','pct','cx','unidade','caixa',
]);

function tokenizar(texto: string): Set<string> {
  return new Set(
    normalizar(texto)
      .split(' ')
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
  );
}

function scoreSimilaridadeDescricao(descNcm: string, descProduto: string): number {
  const a = tokenizar(descNcm);
  const b = tokenizar(descProduto);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uniao = new Set([...a, ...b]).size;
  return uniao === 0 ? 0 : inter / uniao;
}

function reordenarPorDescricao(
  sugestoes: SugestaoNcm[],
  descricaoProduto: string
): SugestaoNcm[] {
  if (sugestoes.length <= 1) return sugestoes;

  return [...sugestoes].sort((a, b) => {
    const scoreA = scoreSimilaridadeDescricao(a.descricao, descricaoProduto);
    const scoreB = scoreSimilaridadeDescricao(b.descricao, descricaoProduto);
    if (Math.abs(scoreB - scoreA) > 0.01) return scoreB - scoreA;
    const hierarquia = { mesma_subposicao: 0, mesma_posicao: 1, mesmo_capitulo: 2, busca_texto: 3 };
    return (hierarquia[a.origem] ?? 9) - (hierarquia[b.origem] ?? 9);
  });
}

// ── Estratégia de busca ───────────────────────────────────────────────────

async function buscarSugestoes(
  ncmAtual: string,
  status: Extract<StatusNcm, 'invalido' | 'nao_encontrado'>,
  descricaoProduto: string
): Promise<{ sugestoes: SugestaoNcm[]; textoBusca: string; melhorIndice: number }> {
  const ncmNorm = normalizarCodigo(ncmAtual);

  let sugestoes: SugestaoNcm[] = [];
  let textoBusca = '';

  if (status === 'invalido') {
    sugestoes = await buscarSubstitutosHierarquicos(ncmNorm);
    textoBusca = `Hierarquia do NCM ${ncmNorm}`;
  } else {
    sugestoes = await buscarSubstitutosHierarquicos(ncmNorm);
    textoBusca = `Hierarquia do NCM ${ncmNorm}`;

    if (sugestoes.length === 0) {
      sugestoes = await buscarPorTextoFallback(descricaoProduto);
      textoBusca = `Descrição: "${descricaoProduto.slice(0, 60)}"`;
    }
  }

  const reordenados = reordenarPorDescricao(sugestoes, descricaoProduto);

  return { sugestoes: reordenados, textoBusca, melhorIndice: 0 };
}

// ── Serviço principal ─────────────────────────────────────────────────────

export async function analisarNcmsProblematicos(): Promise<GrupoNcmProblematico[]> {
  const tabelaOficial = await obterTabelaOficial();
  const produtos = await produtosService.listarTodosParaValidacaoNcm();

  const grupos = new Map<
    string,
    {
      status: Extract<StatusNcm, 'invalido' | 'nao_encontrado'>;
      descricao_ncm_antigo: string | null;
      produtos: GrupoNcmProblematico['produtos_afetados'];
    }
  >();

  for (const produto of produtos) {
    if (!produto.ncm || produto.ncm.trim() === '') continue;

    const ncmNorm = normalizarCodigo(produto.ncm.trim());
    const item = tabelaOficial.get(ncmNorm);
    let status: Extract<StatusNcm, 'invalido' | 'nao_encontrado'> | null = null;
    let descricao_ncm_antigo: string | null = null;

    if (!item) {
      status = 'nao_encontrado';
    } else if (item.dataFim && new Date(item.dataFim).getTime() < Date.now()) {
      status = 'invalido';
      descricao_ncm_antigo = item.descricao ?? null;
    }

    if (!status) continue;

    const chave = produto.ncm.trim();
    if (!grupos.has(chave)) {
      grupos.set(chave, { status, descricao_ncm_antigo, produtos: [] });
    }
    grupos.get(chave)!.produtos.push({
      produto_id: produto.id,
      descricao: produto.descricao,
      codigo_barras: produto.codigo_barras,
    });
  }

  if (grupos.size === 0) return [];

  const resultado: GrupoNcmProblematico[] = [];

  for (const [ncmAtual, grupo] of grupos.entries()) {
    const descricaoRepresentativa = grupo.produtos[0]?.descricao ?? '';

    const { sugestoes, textoBusca, melhorIndice } = await buscarSugestoes(
      ncmAtual,
      grupo.status,
      descricaoRepresentativa
    );

    resultado.push({
      ncm_atual: ncmAtual,
      status: grupo.status,
      descricao_ncm_antigo: grupo.descricao_ncm_antigo,
      produtos_afetados: grupo.produtos,
      texto_busca: textoBusca,
      sugestoes,
      melhor_indice: melhorIndice,
    });
  }

  return resultado;
}

// ── Aplicar correções ─────────────────────────────────────────────────────

/**
 * Virou async porque produtosService.atualizar agora bate no Firebird.
 * Sem transação envolvendo os dois bancos (SQLite não tem mais papel aqui):
 * cada correção é aplicada sequencialmente, e falhas individuais não
 * interrompem as demais (mesmo comportamento de antes).
 */
export async function aplicarCorrecoes(correcoes: CorrecaoNcm[]): Promise<{
  total_corrigidos: number;
  detalhes: { produto_id: number; ncm_novo: string; ok: boolean }[];
}> {
  const detalhes: { produto_id: number; ncm_novo: string; ok: boolean }[] = [];
  let totalCorrigidos = 0;

  for (const correcao of correcoes) {
    for (const produto_id of correcao.produto_ids) {
      try {
        await produtosService.atualizar(produto_id, { ncm: correcao.ncm_novo });
        detalhes.push({ produto_id, ncm_novo: correcao.ncm_novo, ok: true });
        totalCorrigidos++;
      } catch {
        detalhes.push({ produto_id, ncm_novo: correcao.ncm_novo, ok: false });
      }
    }
  }

  return { total_corrigidos: totalCorrigidos, detalhes };
}