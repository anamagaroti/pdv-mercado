import { Router } from 'express';
import * as controller from './busca.controller';

const router = Router();

router.get('/similares', controller.similares);
router.get('/codigo-externo/:codigo', controller.codigoExterno);

export default router;
