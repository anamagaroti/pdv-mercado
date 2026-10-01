import { obterTabelaOficial, ItemTabelaNcm, normalizarCodigo } from './tabelaOficial.service';

export interface SugestaoNcm {
  codigo: string;
  descricao: string;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;

  origem:
    | 'mesma_subposicao'
    | 'mesma_posicao'
    | 'mesmo_capitulo'
    | 'busca_texto'
    | 'busca_hierarquica';
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



/**
 * Resultado interno utilizado pelo classificador.
 */
interface CandidatoHierarquico {
  item: ItemTabelaNcm;
  score: number;
  nivelMelhorMatch: number;
  descricaoHierarquica: string;
}

/**
 * Palavras muito genéricas ou que não ajudam a identificar
 * a classificação fiscal do produto.
 */
const STOPWORDS_NCM = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',

  'de',
  'do',
  'da',
  'dos',
  'das',

  'e',
  'em',
  'com',
  'sem',
  'para',
  'por',

  'kg',
  'g',
  'mg',
  'ml',
  'l',

  'un',
  'und',
  'unidade',
  'unidades',

  'cx',
  'caixa',
  'caixas',

  'pct',
  'pacote',
  'pacotes',

  'fardo',
  'fardos',

  'litro',
  'litros',

  'grama',
  'gramas',

  'quilo',
  'quilos',
]);

/**
 * Normaliza um texto para comparação.
 */
function normalizarTextoNcm(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai palavras relevantes da descrição.
 */
function extrairPalavrasNcm(
  texto: string
): string[] {
  const normalizado =
    normalizarTextoNcm(texto);

  return [
    ...new Set(
      normalizado
        .split(' ')
        .map((palavra) => palavra.trim())
        .filter(
          (palavra) =>
            palavra.length >= 3 &&
            !STOPWORDS_NCM.has(palavra)
        )
    ),
  ];
}

/**
 * Retorna os níveis hierárquicos de um NCM.
 *
 * Exemplo:
 *
 * 07133319
 *
 * pode resultar em:
 *
 * 07
 * 0713
 * 07133
 * 071333
 * 0713331
 * 07133319
 *
 * A função consulta diretamente o Map, portanto não
 * depende de todos os níveis existirem.
 */
function obterHierarquiaNcm(
  codigo: string,
  tabela: Map<string, ItemTabelaNcm>
): ItemTabelaNcm[] {
  const normalizado =
    normalizarCodigo(codigo);

  const candidatos = [
    normalizado.slice(0, 2),
    normalizado.slice(0, 4),
    normalizado.slice(0, 5),
    normalizado.slice(0, 6),
    normalizado.slice(0, 7),
    normalizado.slice(0, 8),
  ];

  return candidatos
    .filter(
      (codigoNivel) =>
        codigoNivel.length > 0
    )
    .map(
      (codigoNivel) =>
        tabela.get(codigoNivel)
    )
    .filter(
      (
        item
      ): item is ItemTabelaNcm =>
        Boolean(item)
    );
}

/**
 * Retorna os NCMs de 8 dígitos que pertencem
 * a uma determinada hierarquia.
 */
function obterFolhasDaHierarquia(
  codigoPai: string,
  tabela: Map<string, ItemTabelaNcm>
): ItemTabelaNcm[] {
  const agora = Date.now();

  return [...tabela.values()].filter(
    (item) => {
      if (item.codigo.length !== 8) {
        return false;
      }

      if (!item.codigo.startsWith(codigoPai)) {
        return false;
      }

      if (
        item.dataFim &&
        new Date(item.dataFim).getTime() < agora
      ) {
        return false;
      }

      return true;
    }
  );
}

/**
 * Retorna um peso de acordo com o nível hierárquico.
 *
 * Quanto mais específico o nível, maior o peso.
 *
 * 2 dígitos  -> capítulo
 * 4 dígitos  -> posição
 * 5 dígitos  -> subposição
 * 6 dígitos  -> subposição
 * 7 dígitos  -> item
 * 8 dígitos  -> NCM final
 */
function pesoNivelHierarquico(
  quantidadeDigitos: number
): number {
  switch (quantidadeDigitos) {
    case 2:
      return 1;

    case 4:
      return 3;

    case 5:
      return 5;

    case 6:
      return 7;

    case 7:
      return 9;

    case 8:
      return 10;

    default:
      return 1;
  }
}

/**
 * Calcula quanto uma palavra do produto combina
 * com uma descrição da hierarquia.
 */
function calcularMatchPalavra(
  palavra: string,
  descricao: string
): number {
  const texto =
    normalizarTextoNcm(descricao);

  const palavrasDescricao =
    new Set(
      texto.split(' ')
    );

  /**
   * Match exato:
   *
   * "feijao" === "feijao"
   */
  if (palavrasDescricao.has(palavra)) {
    return 1;
  }

  /**
   * Também permitimos que uma palavra seja parte
   * de outra, mas com peso menor.
   *
   * Exemplo:
   * "chocolate" dentro de "chocolates"
   */
  if (
    texto.includes(` ${palavra} `) ||
    texto.startsWith(`${palavra} `) ||
    texto.endsWith(` ${palavra}`)
  ) {
    return 0.85;
  }

  /**
   * Prefixo:
   *
   * "feijao" pode aparecer como parte de alguma
   * variação textual.
   */
  for (const palavraDescricao of palavrasDescricao) {
    if (
      palavraDescricao.startsWith(
        palavra
      ) &&
      palavra.length >= 4
    ) {
      return 0.7;
    }
  }

  return 0;
}

/**
 * Calcula o score de uma descrição de hierarquia
 * em relação à descrição do produto.
 */
function calcularScoreHierarquia(
  palavrasProduto: string[],
  hierarquia: ItemTabelaNcm[]
): {
  score: number;
  nivelMelhorMatch: number;
} {
  let score = 0;

  let nivelMelhorMatch = 0;

  /**
   * Guarda palavras já utilizadas para evitar
   * dar peso excessivo à mesma palavra em vários
   * níveis da hierarquia.
   */
  const melhoresMatches =
    new Map<
      string,
      {
        peso: number;
        nivel: number;
      }
    >();

  for (const item of hierarquia) {
    const pesoNivel =
      pesoNivelHierarquico(
        item.codigo.length
      );

    for (const palavra of palavrasProduto) {
      const match =
        calcularMatchPalavra(
          palavra,
          item.descricao
        );

      if (match <= 0) {
        continue;
      }

      const pesoFinal =
        match * pesoNivel;

      const atual =
        melhoresMatches.get(
          palavra
        );

      if (
        !atual ||
        pesoFinal > atual.peso
      ) {
        melhoresMatches.set(
          palavra,
          {
            peso: pesoFinal,
            nivel: item.codigo.length,
          }
        );
      }
    }
  }

  for (const match of melhoresMatches.values()) {
    score += match.peso;

    nivelMelhorMatch =
      Math.max(
        nivelMelhorMatch,
        match.nivel
      );
  }

  return {
    score,
    nivelMelhorMatch,
  };
}

/**
 * Classifica um produto pela descrição utilizando
 * a hierarquia oficial da NCM.
 *
 * Exemplo:
 *
 * "FEIJÃO CARIOCA 1KG"
 *
 * não é comparado somente contra:
 *
 * "Outros"
 *
 * A função considera:
 *
 * 07      -> Produtos hortícolas...
 * 0713    -> Legumes de vagem...
 * 07133   -> Feijões
 * 071333  -> Feijão comum
 * 0713331 -> Preto
 * 07133319 -> Outros
 *
 * e então avalia quais folhas de 8 dígitos
 * pertencem às ramificações relevantes.
 */
export async function buscarNcmPorDescricaoHierarquica(
  descricaoProduto: string,
  limite = 8
): Promise<SugestaoNcm[]> {
  if (
    !descricaoProduto ||
    descricaoProduto.trim().length < 3
  ) {
    return [];
  }

  const palavrasProduto =
    extrairPalavrasNcm(
      descricaoProduto
    );

  if (palavrasProduto.length === 0) {
    return [];
  }

  const tabela =
    await obterTabelaOficial();

  const agora = Date.now();

  /**
   * Primeiro encontramos os nós da hierarquia
   * que possuem alguma relação textual com o produto.
   */
  const nosRelevantes: {
    item: ItemTabelaNcm;
    score: number;
  }[] = [];

  for (const item of tabela.values()) {
    /**
     * O próprio NCM final será avaliado depois.
     * Aqui queremos descobrir a ramificação.
     */
    if (item.codigo.length >= 8) {
      continue;
    }

    if (
      item.dataFim &&
      new Date(item.dataFim).getTime() <
        agora
    ) {
      continue;
    }

    const descricaoNormalizada =
      normalizarTextoNcm(
        item.descricao
      );

    if (!descricaoNormalizada) {
      continue;
    }

    let score = 0;

    for (const palavra of palavrasProduto) {
      const match =
        calcularMatchPalavra(
          palavra,
          descricaoNormalizada
        );

      if (match <= 0) {
        continue;
      }

      const peso =
        pesoNivelHierarquico(
          item.codigo.length
        );

      score +=
        match * peso;
    }

    if (score > 0) {
      nosRelevantes.push({
        item,
        score,
      });
    }
  }

  /**
   * Se não encontramos nenhuma ramificação
   * semântica, não tentamos inventar uma classificação.
   *
   * Nesse caso podemos retornar vazio e deixar
   * o sistema utilizar o fallback textual antigo.
   */
  if (nosRelevantes.length === 0) {
    return [];
  }

  /**
   * Ordena os nós mais relevantes.
   */
  nosRelevantes.sort(
    (a, b) => b.score - a.score
  );

  /**
   * Mantemos somente uma quantidade razoável
   * de ramificações.
   *
   * Isso evita que uma palavra genérica como
   * "produto" abra milhares de NCMs.
   */
  const nosSelecionados =
    nosRelevantes.slice(0, 12);

  /**
   * Agora coletamos as folhas de 8 dígitos
   * pertencentes às ramificações encontradas.
   */
  const codigosFolha =
    new Set<string>();

  for (const no of nosSelecionados) {
    const folhas =
      obterFolhasDaHierarquia(
        no.item.codigo,
        tabela
      );

    for (const folha of folhas) {
      codigosFolha.add(
        folha.codigo
      );
    }
  }

  /**
   * Se não encontramos folhas diretamente,
   * tentamos novamente usando os nós relevantes
   * mais específicos.
   */
  if (codigosFolha.size === 0) {
    return [];
  }

  /**
   * Agora fazemos a avaliação completa de cada
   * NCM de 8 dígitos.
   */
  const candidatos: CandidatoHierarquico[] =
    [];

  for (const codigo of codigosFolha) {
    const item =
      tabela.get(codigo);

    if (!item) {
      continue;
    }

    if (
      item.dataFim &&
      new Date(item.dataFim).getTime() <
        agora
    ) {
      continue;
    }

    const hierarquia =
      obterHierarquiaNcm(
        codigo,
        tabela
      );

    if (hierarquia.length === 0) {
      continue;
    }

    const resultado =
      calcularScoreHierarquia(
        palavrasProduto,
        hierarquia
      );

    if (resultado.score <= 0) {
      continue;
    }

    /**
     * Descrição completa da árvore.
     *
     * Isso também é útil para debug.
     */
    const descricaoHierarquica =
      hierarquia
        .map(
          (nivel) =>
            nivel.descricao
        )
        .filter(Boolean)
        .join(' > ');

    candidatos.push({
      item,
      score: resultado.score,
      nivelMelhorMatch:
        resultado.nivelMelhorMatch,
      descricaoHierarquica,
    });
  }

  /**
   * Ordenação:
   *
   * 1. score semântico
   * 2. nível mais específico em que houve match
   * 3. código para garantir ordem determinística
   */
  candidatos.sort(
    (a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (
        b.nivelMelhorMatch !==
        a.nivelMelhorMatch
      ) {
        return (
          b.nivelMelhorMatch -
          a.nivelMelhorMatch
        );
      }

      return a.item.codigo.localeCompare(
        b.item.codigo
      );
    }
  );

  /**
   * Remove duplicados pelo código.
   */
  const resultadoFinal: SugestaoNcm[] =
    [];

  const codigosJaAdicionados =
    new Set<string>();

  for (const candidato of candidatos) {
    if (
      codigosJaAdicionados.has(
        candidato.item.codigo
      )
    ) {
      continue;
    }

    codigosJaAdicionados.add(
      candidato.item.codigo
    );

    resultadoFinal.push({
      codigo: candidato.item.codigo,

      descricao:
        candidato.item.descricao,

      data_inicio:
        candidato.item.dataInicio,

      data_fim:
        candidato.item.dataFim,

      ativo: true,

      origem:
        'busca_hierarquica',
    });

    if (
      resultadoFinal.length >= limite
    ) {
      break;
    }
  }

  return resultadoFinal;
}
