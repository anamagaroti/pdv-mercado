// pdf-parse é CJS — importa via require para evitar problema de tipagem
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buffer: Buffer, options?: any) => Promise<{ text: string }> = require('pdf-parse');

import { decodificarChave, ChaveDecodificada } from './nfeChave.service';

export interface ResultadoPdfExtract {
  sucesso: boolean;
  chave?: string;
  chaveDecodificada?: ChaveDecodificada;
  textoBruto?: string;
  erro?: string;
}

/**
 * Extrai a chave de acesso de 44 dígitos do texto de um DANFE PDF.
 * Tenta múltiplas estratégias para lidar com diferentes formatações
 * (grupos de 4 ou 11 dígitos, espaços, newlines, pontos, etc.).
 */
function encontrarChaveNoTexto(texto: string): string | null {
  // Normaliza espaços e quebras de linha para uma versão limpa
  const norm = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // ── Estratégia 1: 44 dígitos contínuos (XML embutido ou formato raro) ──
  const m1 = norm.match(/\b(\d{44})\b/);
  if (m1) {
    const d = decodificarChave(m1[1]);
    if (d.valida) return m1[1];
  }

  // ── Estratégia 2: 11 grupos de 4 dígitos separados por espaço/newline ──
  // Formato mais comum: "3524 0100 0738 0706 6512 5500 1000 0001 2312 3456 7890"
  const m2 = norm.match(/(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})[\s\n]+(\d{4})/);
  if (m2) {
    const chave = m2.slice(1).join('');
    const d = decodificarChave(chave);
    if (d.valida) return chave;
  }

  // ── Estratégia 3: grupos de 4 separados por ponto ou traço ──
  const m3 = norm.match(/\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}[.\-]\d{4}/);
  if (m3) {
    const chave = m3[0].replace(/[^\d]/g, '');
    if (chave.length === 44) {
      const d = decodificarChave(chave);
      if (d.valida) return chave;
    }
  }

  // ── Estratégia 4: 4 grupos de 11 dígitos (formato alternativo) ──
  const m4 = norm.match(/(\d{11})\s+(\d{11})\s+(\d{11})\s+(\d{11})/);
  if (m4) {
    const chave = m4.slice(1).join('');
    if (chave.length === 44) {
      const d = decodificarChave(chave);
      if (d.valida) return chave;
    }
  }

  // ── Estratégia 5: blocos de dígitos adjacentes que, concatenados, formam 44 ──
  // Lida com casos onde o PDF insere quebras de linha no meio da chave.
  const todosOsBlocos = norm.match(/\d{3,}/g) ?? [];
  for (let i = 0; i < todosOsBlocos.length; i++) {
    let acumulado = '';
    for (let j = i; j < Math.min(i + 20, todosOsBlocos.length); j++) {
      acumulado += todosOsBlocos[j];
      if (acumulado.length === 44) {
        const d = decodificarChave(acumulado);
        if (d.valida) return acumulado;
        break;
      }
      if (acumulado.length > 44) break;
    }
  }

  // ── Estratégia 6: busca pela região "Chave de Acesso" e pega todos os dígitos após ──
  const idxChave = norm.toLowerCase().search(/chave\s*(de\s*)?acesso/);
  if (idxChave !== -1) {
    const regiao = norm.slice(idxChave, idxChave + 300);
    const digitosRegiao = regiao.replace(/[^\d]/g, '');
    // Tenta encontrar 44 dígitos consecutivos nessa região
    for (let k = 0; k <= digitosRegiao.length - 44; k++) {
      const candidato = digitosRegiao.slice(k, k + 44);
      const d = decodificarChave(candidato);
      if (d.valida) return candidato;
    }
  }

  return null;
}

export async function extrairChaveDoPdf(pdfBuffer: Buffer): Promise<ResultadoPdfExtract> {
  let texto = '';
  try {
    const resultado = await pdfParse(pdfBuffer, { max: 0 });
    texto = resultado.text;
  } catch (e: any) {
    return { sucesso: false, erro: `Não foi possível ler o PDF: ${e.message}` };
  }

  if (!texto || texto.trim().length < 10) {
    return {
      sucesso: false,
      erro: 'O PDF não contém texto extraível (provável PDF escaneado/imagem). Nesse caso, bipe o código de barras do DANFE ou importe o XML.',
    };
  }

  const chave = encontrarChaveNoTexto(texto);
  if (!chave) {
    return {
      sucesso: false,
      textoBruto: texto.slice(0, 800),
      erro: 'Chave de acesso não encontrada no PDF. Tente bipar o código de barras do DANFE ou importe o XML diretamente.',
    };
  }

  return {
    sucesso: true,
    chave,
    chaveDecodificada: decodificarChave(chave),
  };
}
