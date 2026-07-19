import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as nfeService from './nfe.service';
import * as certService from './certificado.service';
import { extrairChaveDoPdf } from './nfePdf.service';
import { decodificarChave } from './nfeChave.service';
import { consultarNfeSefaz } from './nfeSefaz.service';
import db from '../../db/database';
import { importarNfe } from './nfe.service';
import { consultarDistribuicaoDFe } from './Nfedistribuicaodfe.service';
import { obterCnpjEmpresa } from '../configuracoes/configEmpresa.service';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

// ── XML ────────────────────────────────────────────────────────────────────

router.post('/importar', upload.single('arquivo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ mensagem: 'Nenhum arquivo enviado.' });
  try {
    const nfe = await nfeService.importarNfe(req.file.buffer);
    return res.status(201).json(nfe);
  } catch (e: any) {
    return res.status(400).json({ mensagem: 'Erro ao processar NF-e.', detalhe: e.message });
  }
});

// ── PDF ────────────────────────────────────────────────────────────────────

router.post('/por-pdf', upload.single('arquivo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ mensagem: 'Nenhum arquivo enviado.' });

  const resultado = await extrairChaveDoPdf(req.file.buffer);
  if (!resultado.sucesso || !resultado.chave) {
    return res.status(422).json({ mensagem: resultado.erro, textoBruto: resultado.textoBruto });
  }

  const dec = resultado.chaveDecodificada!;

  const consultaSefaz = await consultarNfeSefaz(dec.chave, dec.cUF);
  if (consultaSefaz.sucesso && consultaSefaz.xmlNfe) {
    try {
      const nfe = await nfeService.importarNfe(Buffer.from(consultaSefaz.xmlNfe, 'utf-8'));
      return res.json({ origem: 'sefaz', nfe });
    } catch { /* cai no retorno parcial */ }
  }

  return res.json({
    origem: 'chave_parcial',
    chave: dec,
    requerCertificado: consultaSefaz.requerCertificado ?? false,
    mensagemSefaz: consultaSefaz.erro,
    urlConsultaPortal: dec.urlConsultaPortal,
  });
});

// ── Chave de barras (bipagem) ──────────────────────────────────────────────

router.post('/por-chave', async (req: Request, res: Response) => {
  const { chave: chaveRaw } = req.body ?? {};
  if (!chaveRaw) return res.status(400).json({ mensagem: 'Informe a chave de acesso.' });

  const dec = decodificarChave(String(chaveRaw));
  if (!dec.valida) return res.status(422).json({ mensagem: dec.erro });

  // Verifica se já foi importada antes (SQLite — tabela nfes é local, não muda)
  const jaImportada = db.prepare('SELECT id FROM nfes WHERE chave_acesso = ?').get(dec.chave) as any;
  if (jaImportada) {
    const nfe = await nfeService.buscarNfePorId(jaImportada.id);
    return res.json({ origem: 'cache', nfe });
  }

  const consultaSefaz = await consultarNfeSefaz(dec.chave, dec.cUF);
  if (consultaSefaz.sucesso && consultaSefaz.xmlNfe) {
    try {
      const nfe = await nfeService.importarNfe(Buffer.from(consultaSefaz.xmlNfe, 'utf-8'));
      return res.json({ origem: 'sefaz', nfe });
    } catch (e: any) {
      return res.status(500).json({ mensagem: 'XML recebido do SEFAZ mas inválido.', detalhe: e.message });
    }
  }

  return res.json({
    origem: 'chave_parcial',
    chave: dec,
    requerCertificado: consultaSefaz.requerCertificado ?? false,
    mensagemSefaz: consultaSefaz.erro,
    urlConsultaPortal: dec.urlConsultaPortal,
  });
});

// ── Certificado ────────────────────────────────────────────────────────────

router.get('/certificado/status', (_req: Request, res: Response) => {
  return res.json(certService.obterStatusCertificado());
});

router.post('/certificado', upload.single('arquivo'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ mensagem: 'Nenhum arquivo .pfx enviado.' });
  const { senha } = req.body ?? {};
  if (!senha) return res.status(400).json({ mensagem: 'Informe a senha do certificado.' });
  const resultado = certService.salvarCertificado(req.file.buffer, String(senha));
  if (!resultado.valido) return res.status(422).json({ mensagem: resultado.mensagem });
  return res.json(resultado);
});

router.delete('/certificado', (_req: Request, res: Response) => {
  certService.removerCertificado();
  return res.json({ mensagem: 'Certificado removido.' });
});

// ── CRUD ───────────────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => res.json(nfeService.listarNfes()));

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const nfe = await nfeService.buscarNfePorId(Number(req.params.id));
    if (!nfe) return res.status(404).json({ mensagem: 'NF-e não encontrada.' });
    return res.json(nfe);
  } catch (e: any) {
    return res.status(500).json({ mensagem: e.message });
  }
});

router.post('/aplicar-precos', async (req: Request, res: Response) => {
  const { itens } = req.body ?? {};
  if (!Array.isArray(itens) || itens.length === 0)
    return res.status(400).json({ mensagem: 'Nenhum item informado.' });
  try {
    return res.json(await nfeService.aplicarPrecos(itens));
  } catch (e: any) {
    return res.status(500).json({ mensagem: e.message });
  }
});

router.post('/consultar-e-importar', async (req, res) => {
  const { chave } = req.body;

  const cnpjEmpresa = obterCnpjEmpresa();
  if (!cnpjEmpresa) {
    return res.status(400).json({
      erro: 'Configure o CNPJ da empresa em Configurações antes de consultar notas.',
    });
  }

  const { cUF, valida } = decodificarChave(chave);
  if (!valida) {
    return res.status(400).json({ erro: 'Chave de acesso inválida.' });
  }

  // 1) Confirma que a nota está autorizada (o que já testamos e funciona)
  const status = await consultarNfeSefaz(chave, cUF);
  if (!status.sucesso) {
    return res.status(400).json({ erro: status.erro, cStat: status.cStat });
  }

  // 2) Baixa o XML completo (itens, NCM, valores) via Distribuição DFe
  const distribuicao = await consultarDistribuicaoDFe(chave, cUF, cnpjEmpresa);
  if (!distribuicao.sucesso || !distribuicao.xmlNfeCompleto) {
    return res.status(400).json({
      erro: distribuicao.erro ?? 'Não foi possível baixar o XML completo da nota.',
      cStat: distribuicao.cStat,
    });
  }

  // 3) Importa igual você já faz com upload manual — reaproveitando 100% do fluxo existente
  const nfeImportada = await importarNfe(distribuicao.xmlNfeCompleto);

  res.json({ sucesso: true, nfe: nfeImportada });
});

export default router;