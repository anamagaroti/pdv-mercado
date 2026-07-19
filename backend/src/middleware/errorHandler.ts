import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  erro: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[erro]', erro);
  res.status(erro.status ?? 500).json({
    mensagem: erro.message ?? 'Erro interno no servidor.',
  });
}
