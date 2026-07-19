/**
 * Utilitários de normalização de texto usados pela busca por similaridade.
 * O objetivo é aproximar "Farinha de trigo Dona Benta 1kg" de
 * "Farinha de trigo Sol 1kg", ignorando marca e diferenças de acentuação/caixa.
 */

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizar(texto: string): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .filter((t) => t.length > 1); // descarta tokens muito curtos (ex: "de", "a")
}

/**
 * Remove tokens que correspondem a marcas conhecidas da base, para que a
 * comparação de similaridade foque no PRODUTO em si, não em quem o fabrica.
 * Ex: dado marcasConhecidas = ["dona benta", "sol", "anaconda"], a busca
 * "Farinha de trigo Dona Benta 1kg" passa a comparar como "farinha trigo 1kg".
 */
export function removerMarcasConhecidas(
  textoNormalizado: string,
  marcasConhecidas: string[]
): string {
  let resultado = ` ${textoNormalizado} `;
  for (const marca of marcasConhecidas) {
    const marcaNorm = normalizarTexto(marca);
    if (marcaNorm.length < 2) continue;
    resultado = resultado.replace(new RegExp(`\\s${marcaNorm}\\s`, 'g'), ' ');
  }
  return resultado.trim();
}

/** Similaridade de Jaccard entre os conjuntos de tokens de dois textos (0 a 1). */
export function similaridadeJaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersecao = 0;
  for (const t of setA) if (setB.has(t)) intersecao++;
  const uniao = new Set([...setA, ...setB]).size;
  return uniao === 0 ? 0 : intersecao / uniao;
}
