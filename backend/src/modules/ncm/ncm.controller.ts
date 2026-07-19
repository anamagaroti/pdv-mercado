import { Request, Response } from 'express';
import * as ncmService from './ncm.service';
import * as analisadorService from './ncmAnalisador.service';
import { buscarPorTextoFallback } from './siscomexBusca.service';

export async function validarTodos(req: Request, res: Response) {
  const { forcarAtualizacaoTabela, ignorarCache } = req.body ?? {};
  try {
    const resultado = await ncmService.validarTodosOsNcms({
      forcarAtualizacaoTabela: Boolean(forcarAtualizacaoTabela),
      ignorarCache: Boolean(ignorarCache),
    });
    return res.json(resultado);
  } catch (erro: any) {
    return res.status(502).json({
      mensagem: 'Não foi possível consultar a tabela oficial de NCM (Portal Siscomex). Verifique a conexão e tente novamente.',
      detalhe: erro.message,
    });
  }
}

export function ultimaValidacao(req: Request, res: Response) {
  return res.json(ncmService.obterUltimaValidacaoSalva());
}

export async function analisarProblematicos(req: Request, res: Response) {
  try {
    const grupos = await analisadorService.analisarNcmsProblematicos();
    return res.json(grupos);
  } catch (erro: any) {
    return res.status(502).json({
      mensagem: 'Erro ao consultar o Siscomex para análise de NCMs.',
      detalhe: erro.message,
    });
  }
}

export function aplicarCorrecoes(req: Request, res: Response) {
  const { correcoes } = req.body ?? {};
  if (!Array.isArray(correcoes) || correcoes.length === 0) {
    return res.status(400).json({ mensagem: 'Nenhuma correção informada.' });
  }
  const resultado = analisadorService.aplicarCorrecoes(correcoes);
  return res.json(resultado);
}

/**
 * Busca NCMs ativos por descrição textual — usado na tela de cadastro de
 * novo produto para o operador encontrar o NCM correto pelo nome do item.
 */
export async function buscarPorDescricao(req: Request, res: Response) {
  const descricao = typeof req.query.descricao === 'string' ? req.query.descricao : '';
  if (descricao.trim().length < 3) {
    return res.status(400).json({ mensagem: 'Informe ao menos 3 caracteres.' });
  }
  try {
    const sugestoes = await buscarPorTextoFallback(descricao, 10);
    return res.json(sugestoes);
  } catch (erro: any) {
    return res.status(502).json({
      mensagem: 'Erro ao consultar o Siscomex.',
      detalhe: erro.message,
    });
  }
}
