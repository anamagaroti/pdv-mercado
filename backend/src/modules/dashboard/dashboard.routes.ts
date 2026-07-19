import { Router, Request, Response } from 'express';
import * as dashboardService from './dashboard.service';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json(dashboardService.obterEstatisticas());
});

export default router;
