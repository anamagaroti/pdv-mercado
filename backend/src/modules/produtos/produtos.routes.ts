import { Router } from "express";
import * as controller from "./produtos.controller";

const router = Router();

router.get("/exportar", controller.exportar);
router.get("/codigo-barras/:codigo", controller.getPorCodigoBarras);
router.get("/:id", controller.getPorId);
router.get("/", controller.listar);
router.post("/", controller.criar);
router.put("/:id", controller.atualizar);
router.delete("/:id", controller.excluir);

export default router;