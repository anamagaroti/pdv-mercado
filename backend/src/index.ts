import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/database';
import { errorHandler } from './middleware/errorHandler';

import produtosRoutes from './modules/produtos/produtos.routes';
import buscaRoutes from './modules/busca/busca.routes';
import importacaoRoutes from './modules/importacao/importacao.routes';
import ncmRoutes from './modules/ncm/ncm.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import configuracoesRoutes from './modules/configuracoes/configuracoes.routes';

import nfeRoutes from './modules/nfe/nfe.routes';

initDatabase();

const app = express();
const PORT = process.env.PORT ?? 3002;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/saude', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/produtos', produtosRoutes);
app.use('/api/busca', buscaRoutes);
app.use('/api/importacao', importacaoRoutes);
app.use('/api/ncm', ncmRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/nfe', nfeRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[servidor] Rodando em http://localhost:${PORT}`);
});
