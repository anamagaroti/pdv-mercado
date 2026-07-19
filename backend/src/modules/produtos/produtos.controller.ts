import { Request, Response } from "express";
import * as XLSX from "xlsx";
import * as produtosService from "./produtos.service";
import * as produtosRepository from "./produtos.repository";

export async function getPorCodigoBarras(req: Request, res: Response) {
  try {
    const { codigo } = req.params;
    const produto = await produtosService.buscarPorCodigoBarras(codigo);
    if (!produto) {
      return res.json({ encontrado: false, mensagem: "Código não encontrado." });
    }
    return res.json({ encontrado: true, produto });
  } catch (erro: any) {
    return res.status(500).json({ mensagem: erro.message });
  }
}

export async function getPorId(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const produto = await produtosService.buscarPorId(id);
    if (!produto) return res.status(404).json({ mensagem: "Produto não encontrado." });
    return res.json(produto);
  } catch (erro: any) {
    return res.status(500).json({ mensagem: erro.message });
  }
}

export async function listar(req: Request, res: Response) {
  try {
    const { pagina, tamanhoPagina, termo, semNcm, semSituacaoTributaria } = req.query;
    const resultado = await produtosService.listar({
      pagina: pagina ? Number(pagina) : undefined,
      tamanhoPagina: tamanhoPagina ? Number(tamanhoPagina) : undefined,
      termo: typeof termo === "string" ? termo : undefined,
      semNcm: semNcm === "true",
      semSituacaoTributaria: semSituacaoTributaria === "true",
    });
    return res.json(resultado);
  } catch (erro: any) {
    return res.status(500).json({ mensagem: erro.message });
  }
}

export async function criar(req: Request, res: Response) {
  const { codigo_barras, descricao } = req.body;
  if (!codigo_barras || !descricao) {
    return res.status(400).json({ mensagem: "codigo_barras e descricao são obrigatórios." });
  }
  try {
    const produto = await produtosService.criar(req.body);
    return res.status(201).json(produto);
  } catch (erro: any) {
    return res.status(400).json({ mensagem: erro.message });
  }
}

export async function atualizar(req: Request, res: Response) {
  const id = Number(req.params.id);
  try {
    const produto = await produtosService.atualizar(id, req.body);
    return res.json(produto);
  } catch (erro: any) {
    return res.status(404).json({ mensagem: erro.message });
  }
}

export async function excluir(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await produtosService.excluir(id);
    return res.status(204).send();
  } catch (erro: any) {
    return res.status(500).json({ mensagem: erro.message });
  }
}

// Endpoint /historico removido: não existe mais tabela de histórico de
// alterações no Firebird (não temos permissão de DDL para criá-la).

export async function exportar(req: Request, res: Response) {
  try {
    const { termo, semNcm, semSituacaoTributaria } = req.query;

    const produtos = await produtosRepository.listarParaExportacao({
      termo: typeof termo === "string" ? termo : undefined,
      semNcm: semNcm === "true",
      semSituacaoTributaria: semSituacaoTributaria === "true",
    });

    // Colunas alinhadas ao que existe hoje no Firebird. NOMEGRUPO, SUBGRUPO
    // e VALORCUSTO saíram porque grupo/subgrupo/preco_custo não existem mais.
    const linhas = produtos.map((p) => ({
      PRODUTOIDO: p.id,
      DESCRICAO: p.descricao ?? "",
      VALORVENDA: p.preco ?? "",
      CODIGOBARRA: p.codigo_barras ?? "",
      SITUACAO_TRIBUTARIA: p.situacao_tributaria ?? "",
      NCM: p.ncm ?? "",
      CEST: p.cest ?? "",
      ATIVO: p.ativo ? 1 : 0,
    }));

    const ws = XLSX.utils.json_to_sheet(linhas.length > 0 ? linhas : [{}]);
    ws["!cols"] = Object.keys(linhas[0] ?? {}).map((key) => ({
      wch: Math.max(
        key.length,
        ...linhas.slice(0, 200).map((r) => String((r as any)[key] ?? "").length)
      ),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const dataHoje = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="produtos-${dataHoje}.xlsx"`);
    return res.send(buffer);
  } catch (erro: any) {
    return res.status(500).json({ mensagem: erro.message });
  }
}