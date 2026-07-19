import { obterTabelaOficial, ItemTabelaNcm, normalizarCodigo } from './tabelaOficial.service';

export interface SugestaoNcm {
  codigo: string;
  descricao: string;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  /** Como essa sugestão foi encontrada (para exibir ao usuário) */
  origem: 'mesma_subposicao' | 'mesma_posicao' | 'mesmo_capitulo' | 'busca_texto';
}

/**
 * Estratégia hierárquica: dado um código NCM (ativo ou não), encontra os
 * NCMs ativos mais próximos na hierarquia.
 *
 * O NCM tem 4 níveis:
 *   XX          → capítulo      (2 dígitos)
 *   XXXX        → posição       (4 dígitos)
 *   XXXXXX      → subposição    (6 dígitos)
 *   XXXXXXXX    → item          (8 dígitos)
 *
 * Para um NCM inválido/expirado, os produtos são quase sempre redistribuídos
 * dentro da mesma subposição ou posição — que é exatamente onde buscamos.
 *
 * Ordem de tentativa:
 *   1. Mesmo prefixo de 6 dígitos (subposição) — mais específico
 *   2. Mesmo prefixo de 4 dígitos (posição)    — se subposição tiver < 2 ativos
 *   3. Mesmo prefixo de 2 dígitos (capítulo)   — último recurso
 */
export async function buscarSubstitutosHierarquicos(
  ncmOriginal: string,
  limite = 8
): Promise<SugestaoNcm[]> {
  const codigo = normalizarCodigo(ncmOriginal);
  if (codigo.length < 2) return [];

  const tabela = await obterTabelaOficial();
  const agora = Date.now();

  const ativas = (prefixo: string): ItemTabelaNcm[] =>
    [...tabela.values()].filter(
      (item) =>
        item.codigo !== codigo && // exclui o próprio NCM problemático
        item.codigo.startsWith(prefixo) &&
        item.codigo.length === 8 && // apenas itens folha (NCM completo)
        (!item.dataFim || new Date(item.dataFim).getTime() > agora)
    );

  const prefixo6 = codigo.slice(0, 6);
  const prefixo4 = codigo.slice(0, 4);
  const prefixo2 = codigo.slice(0, 2);

  let resultados: SugestaoNcm[] = [];
  let origem: SugestaoNcm['origem'] = 'mesma_subposicao';

  // Tenta subposição (6 dígitos)
  let candidatos = ativas(prefixo6);
  if (candidatos.length < 2) {
    // Sobe para posição (4 dígitos)
    candidatos = ativas(prefixo4);
    origem = 'mesma_posicao';
  }
  if (candidatos.length < 2) {
    // Sobe para capítulo (2 dígitos)
    candidatos = ativas(prefixo2);
    origem = 'mesmo_capitulo';
  }

  resultados = candidatos.slice(0, limite).map((item) => ({
    codigo: item.codigo,
    descricao: item.descricao,
    data_inicio: item.dataInicio,
    data_fim: item.dataFim,
    ativo: true,
    origem,
  }));

  return resultados;
}

/**
 * Para NCMs "não encontrados" (código que nunca existiu ou foi totalmente
 * removido sem rastro): tenta a busca hierárquica igual aos inválidos.
 * Se o código for completamente desconhecido (ex: digitação errada), cai
 * no fallback de busca por texto na descrição do produto.
 */
export async function buscarPorTextoFallback(
  descricaoProduto: string,
  limite = 8
): Promise<SugestaoNcm[]> {
  if (!descricaoProduto || descricaoProduto.trim().length < 3) return [];

  const tabela = await obterTabelaOficial();
  const agora = Date.now();

  const palavras = descricaoProduto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(de|do|da|dos|das|e|em|com|para|por|kg|g|ml|l|un|unidade|caixa|pct|pacote)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((p) => p.length > 2);

  if (palavras.length === 0) return [];

  const scored: { item: ItemTabelaNcm; score: number }[] = [];

  for (const item of tabela.values()) {
    if (item.codigo.length !== 8) continue;
    if (item.dataFim && new Date(item.dataFim).getTime() < agora) continue;

    const descNorm = item.descricao
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const matches = palavras.filter((p) => descNorm.includes(p)).length;
    if (matches === 0) continue;

    scored.push({ item, score: matches / palavras.length });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(({ item }) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      data_inicio: item.dataInicio,
      data_fim: item.dataFim,
      ativo: true,
      origem: 'busca_texto' as const,
    }));
}
