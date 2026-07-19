import fs from 'fs';
import path from 'path';
import https from 'https';
import db from '../../db/database';

const CERT_PATH = path.join(__dirname, '..', '..', '..', 'data', 'certificado.pfx');

export interface CertificadoStatus {
  configurado: boolean;
  valido: boolean;
  mensagem: string;
  caminhoArquivo?: string;
}

export function salvarCertificado(buffer: Buffer, senha: string): CertificadoStatus {
  // Valida se o buffer + senha formam um PFX válido antes de salvar
  try {
    new (require('crypto').X509Certificate ?? (() => { throw new Error('crypto'); }));
  } catch { /* ignora, tentamos via https.Agent mesmo */ }

  try {
    // Testa criando um https.Agent — se a senha estiver errada, lança exceção
    new https.Agent({ pfx: buffer, passphrase: senha });
  } catch (e: any) {
    return {
      configurado: false,
      valido: false,
      mensagem: `Certificado inválido ou senha incorreta: ${e.message}`,
    };
  }

  const dir = path.dirname(CERT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CERT_PATH, buffer);

  // Salva a senha nas configurações do sistema (banco)
  db.prepare(
    `INSERT INTO configuracoes (chave, valor) VALUES ('cert_senha', ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
  ).run(senha);

  return {
    configurado: true,
    valido: true,
    mensagem: 'Certificado digital salvo com sucesso.',
    caminhoArquivo: CERT_PATH,
  };
}

export function obterStatusCertificado(): CertificadoStatus {
  if (!fs.existsSync(CERT_PATH)) {
    return { configurado: false, valido: false, mensagem: 'Nenhum certificado configurado.' };
  }
  const senhaRow = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'cert_senha'").get() as any;
  if (!senhaRow) {
    return { configurado: false, valido: false, mensagem: 'Certificado encontrado mas senha não configurada.' };
  }
  return {
    configurado: true,
    valido: true,
    mensagem: 'Certificado digital configurado.',
    caminhoArquivo: CERT_PATH,
  };
}

export function removerCertificado(): void {
  if (fs.existsSync(CERT_PATH)) fs.unlinkSync(CERT_PATH);
  db.prepare("DELETE FROM configuracoes WHERE chave = 'cert_senha'").run();
}

/** Cria um https.Agent autenticado com o certificado salvo */
export function criarAgenteCertificado(): https.Agent | null {
  if (!fs.existsSync(CERT_PATH)) return null;
  const senhaRow = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'cert_senha'").get() as any;
  if (!senhaRow) return null;
  try {
    return new https.Agent({
      pfx: fs.readFileSync(CERT_PATH),
      passphrase: senhaRow.valor,
      rejectUnauthorized: false, // alguns servidores SEFAZ têm cert autoassinado
    });
  } catch {
    return null;
  }
}
