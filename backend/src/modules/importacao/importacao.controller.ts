import { Request, Response } from 'express';
import * as importacaoService from './importacao.service';

export function previa(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ mensagem: 'Nenhum arquivo enviado.' });
  }
  try {
    const resultado = importacaoService.gerarPrevia(req.file.buffer);
    return res.json(resultado);
  } catch (erro: any) {
    return res.status(400).json({
      mensagem: 'Não foi possível ler a planilha. Verifique se é um arquivo .xlsx válido.',
      detalhe: erro.message,
    });
  }
}

export function importar(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ mensagem: 'Nenhum arquivo enviado.' });
  }
  let mapeamento;
  try {
    mapeamento = JSON.parse(req.body.mapeamento ?? '{}');
  } catch {
    return res.status(400).json({ mensagem: 'Mapeamento de colunas inválido.' });
  }

  try {
    const resultado = importacaoService.importar(
      req.file.buffer,
      mapeamento,
      req.file.originalname
    );
    return res.json(resultado);
  } catch (erro: any) {
    return res.status(500).json({ mensagem: 'Erro ao importar planilha.', detalhe: erro.message });
  }
}
