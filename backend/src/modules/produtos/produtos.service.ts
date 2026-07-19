import * as produtosRepository from "./produtos.repository";
import { Produto, ProdutoEditavel, NovoProdutoInput } from "../../types/produto";
import { FiltrosListagem, ResultadoListagem } from "./produtos.repository";

export async function buscarPorCodigoBarras(codigoBarras: string): Promise<Produto | undefined> {
  return produtosRepository.buscarPorCodigoBarras(codigoBarras);
}

export async function buscarPorId(id: number): Promise<Produto | undefined> {
  return produtosRepository.buscarPorId(id);
}

export async function listar(filtros: FiltrosListagem = {}): Promise<ResultadoListagem> {
  return produtosRepository.listar(filtros);
}

export async function criar(dados: NovoProdutoInput): Promise<Produto> {
  if (!dados.codigo_barras?.trim()) {
    throw new Error("codigo_barras é obrigatório.");
  }
  if (!dados.descricao?.trim()) {
    throw new Error("descricao é obrigatória.");
  }
  if (dados.preco !== undefined && dados.preco < 0) {
    throw new Error("preco não pode ser negativo.");
  }
  return produtosRepository.criar(dados);
}

export async function atualizar(id: number, dados: ProdutoEditavel): Promise<Produto> {
  if (dados.preco !== undefined && dados.preco < 0) {
    throw new Error("preco não pode ser negativo.");
  }
  return produtosRepository.atualizar(id, dados);
}

export async function excluir(id: number): Promise<void> {
  return produtosRepository.excluir(id);
}

export async function upsertPorCodigoBarras(
  codigoBarras: string,
  dados: ProdutoEditavel
): Promise<{ produto: Produto; criado: boolean }> {
  return produtosRepository.upsertPorCodigoBarras(codigoBarras, dados);
}

export async function listarTodosNcmsUnicos(): Promise<string[]> {
  return produtosRepository.listarTodosNcmsUnicos();
}

export async function listarTodosParaValidacaoNcm(): Promise<Produto[]> {
  return produtosRepository.listarTodosParaValidacaoNcm();
}

export async function listarTodosParaSimilaridade(excluirId?: number): Promise<Produto[]> {
  return produtosRepository.listarTodosParaSimilaridade(excluirId);
}