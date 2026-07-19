import { Router } from 'express';
import multer from 'multer';
import * as controller from './importacao.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB é mais que suficiente para 8-10k produtos
});

const router = Router();

router.post('/previa', upload.single('arquivo'), controller.previa);
router.post('/importar', upload.single('arquivo'), controller.importar);

export default router;
