import { Router } from "express";
import * as controller from "./tabelasPrecos.controller";

const router = Router();

router.get("/", controller.listarTabelas);
router.get("/produto/:id", controller.precosDoProduto);
router.put("/produto/:id/:tabelaPrecoId", controller.definirPreco);

export default router;
