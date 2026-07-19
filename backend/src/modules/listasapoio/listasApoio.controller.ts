import { Request, Response } from "express";
import * as repositorio from "./listasApoio.repository";

export async function situacoesTributarias(_req: Request, res: Response) {
  try {
    res.json(await repositorio.listarSituacoesTributarias());
  } catch (erro: any) {
    res.status(500).json({ mensagem: erro.message });
  }
}

export async function gruposImposto(_req: Request, res: Response) {
  try {
    res.json(await repositorio.listarGruposImposto());
  } catch (erro: any) {
    res.status(500).json({ mensagem: erro.message });
  }
}

export async function gruposPisCofins(_req: Request, res: Response) {
  try {
    res.json(await repositorio.listarGruposPisCofins());
  } catch (erro: any) {
    res.status(500).json({ mensagem: erro.message });
  }
}
