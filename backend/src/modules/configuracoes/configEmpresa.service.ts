import db from '../../db/database';

/**
 * CNPJ da própria empresa (a "interessada" nas notas — destinatária,
 * emitente ou transportadora). Necessário pra consulta via Distribuição DFe.
 * Reaproveita a mesma tabela `configuracoes` já usada para cert_senha.
 */

export function salvarCnpjEmpresa(cnpj: string): void {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: deve ter 14 dígitos, recebeu ${cnpjLimpo.length}.`);
  }
  db.prepare(
    `INSERT INTO configuracoes (chave, valor) VALUES ('empresa_cnpj', ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
  ).run(cnpjLimpo);
}

export function obterCnpjEmpresa(): string | null {
  const row = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'empresa_cnpj'").get() as any;
  return row?.valor ?? null;
}