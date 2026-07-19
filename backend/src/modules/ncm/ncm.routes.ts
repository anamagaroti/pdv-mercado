import { Router } from 'express';
import * as controller from './ncm.controller';

const router = Router();

router.post('/validar-todos', controller.validarTodos);
router.get('/ultima-validacao', controller.ultimaValidacao);
router.get('/analisar-problematicos', controller.analisarProblematicos);
router.post('/aplicar-correcoes', controller.aplicarCorrecoes);
router.get('/buscar-por-descricao', controller.buscarPorDescricao);

export default router;
