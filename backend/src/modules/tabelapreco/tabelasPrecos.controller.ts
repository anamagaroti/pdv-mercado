import { Request, Response } from "express";
import * as repositorio from "./tabelasPrecos.repository";

export async function listarTabelas(_req: Request, res: Response) {
  try {
    res.json(await repositorio.listarTabelasPrecos());
  } catch (erro: any) {
    res.status(500).json({ mensagem: erro.message });
  }
}

export async function precosDoProduto(req: Request, res: Response) {
  try {
    const produtoId = Number(req.params.id);
    res.json(await repositorio.buscarPrecosDoProduto(produtoId));
  } catch (erro: any) {
    res.status(500).json({ mensagem: erro.message });
  }
}

export async function definirPreco(req: Request, res: Response) {
  try {
    const produtoId = Number(req.params.id);
    const tabelaPrecoId = Number(req.params.tabelaPrecoId);
    const { valorVenda } = req.body;
    if (typeof valorVenda !== "number" || isNaN(valorVenda)) {
      return res.status(400).json({ mensagem: "valorVenda deve ser numérico." });
    }
    await repositorio.definirPrecoProduto(produtoId, tabelaPrecoId, valorVenda);
    return res.status(204).send();
  } catch (erro: any) {
    return res.status(500).json({ mensagem: erro.message });
  }
}
