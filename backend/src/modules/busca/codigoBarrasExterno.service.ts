import axios from 'axios';

export interface InfoCodigoBarrasExterno {
  encontrado: boolean;
  descricao?: string;
  marca?: string;
  fonte?: string;
}

/**
 * Tenta obter informações de um código de barras (EAN/GTIN) numa API
 * gratuita e sem necessidade de chave de acesso.
 *
 * Fonte utilizada: Open Food Facts (https://world.openfoodfacts.org), uma
 * base colaborativa e aberta de produtos, focada em alimentos — o que cobre
 * bem o catálogo típico de um mercado. Para produtos fora do escopo de
 * alimentos, a busca simplesmente retorna "não encontrado" e o sistema cai
 * no fluxo manual (descrição digitada pelo operador).
 *
 * Esta função foi isolada em seu próprio módulo justamente para deixar
 * preparada a evolução futura mencionada no escopo: trocar ou combinar com
 * outras fontes (ex: Cosmos/Bluesoft, que cobre mais categorias mas exige
 * cadastro e token) sem impactar o restante do sistema.
 */
export async function consultarCodigoBarrasExterno(
  codigoBarras: string
): Promise<InfoCodigoBarrasExterno> {
  try {
    const resposta = await axios.get(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        codigoBarras
      )}.json`,
      { timeout: 4000 }
    );

    const produto = resposta.data?.product;
    if (resposta.data?.status !== 1 || !produto) {
      return { encontrado: false };
    }

    const descricao: string | undefined =
      produto.product_name_pt || produto.product_name || produto.generic_name;

    if (!descricao) {
      return { encontrado: false };
    }

    return {
      encontrado: true,
      descricao,
      marca: produto.brands,
      fonte: 'Open Food Facts',
    };
  } catch {
    // API indisponível, timeout, ou código não encontrado — qualquer falha
    // aqui deve apenas cair no fluxo manual, nunca quebrar o cadastro.
    return { encontrado: false };
  }
}