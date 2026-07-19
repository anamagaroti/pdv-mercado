import { Request, Response } from 'express';
import * as similaridadeService from './similaridade.service';
import * as externoService from './codigoBarrasExterno.service';

export async function similares(req: Request, res: Response) {
  const { descricao, excluirId, limite } = req.query;
  if (!descricao || typeof descricao !== 'string') {
    return res.status(400).json({ mensagem: 'Parâmetro "descricao" é obrigatório.' });
  }
  try {
    const resultado = await similaridadeService.buscarSimilares(descricao, {
      excluirId: excluirId ? Number(excluirId) : undefined,
      limite: limite ? Number(limite) : undefined,
    });
    return res.json(resultado);
  } catch (erro: any) {
    return res.status(500).json({ mensagem: erro.message });
  }
}

export async function codigoExterno(req: Request, res: Response) {
  const { codigo } = req.params;
  const resultado = await externoService.consultarCodigoBarrasExterno(codigo);
  return res.json(resultado);
}