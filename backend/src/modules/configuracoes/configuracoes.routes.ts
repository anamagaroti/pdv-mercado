import { Router, Request, Response } from 'express';
import db from '../../db/database';
import { salvarCnpjEmpresa, obterCnpjEmpresa } from './configEmpresa.service';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const linhas = db.prepare('SELECT chave, valor FROM configuracoes').all() as {
    chave: string;
    valor: string;
  }[];
  const configuracoes: Record<string, string> = {};
  for (const linha of linhas) configuracoes[linha.chave] = linha.valor;
  res.json(configuracoes);
});

router.put('/:chave', (req: Request, res: Response) => {
  const { chave } = req.params;
  const { valor } = req.body;
  db.prepare(
    `INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
  ).run(chave, typeof valor === 'string' ? valor : JSON.stringify(valor));
  res.json({ chave, valor });
});

router.get('/empresa', (req, res) => {
  const cnpj = obterCnpjEmpresa();
  res.json({ cnpj });
});
 
router.post('/empresa', (req, res) => {
  try {
    const { cnpj } = req.body;
    if (!cnpj) {
      return res.status(400).json({ erro: 'CNPJ não informado.' });
    }
    salvarCnpjEmpresa(cnpj);
    res.json({ sucesso: true });
  } catch (e: any) {
    res.status(400).json({ erro: e.message });
  }
});

export default router;
