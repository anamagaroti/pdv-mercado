import { Router } from "express";
import * as controller from "./listasApoio.controller";

const router = Router();

router.get("/situacoes-tributarias", controller.situacoesTributarias);
router.get("/grupos-imposto", controller.gruposImposto);
router.get("/grupos-pis-cofins", controller.gruposPisCofins);

export default router;
