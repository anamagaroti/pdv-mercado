import Firebird from "node-firebird";

function obrigatorio(nome: string, valor: string | undefined): string {
  if (!valor || !valor.trim()) {
    throw new Error(
      `Variável de ambiente ${nome} não está definida. Verifique se o .env está sendo ` +
        `carregado ANTES de qualquer import relacionado ao Firebird (ex.: ` +
        `'import "dotenv/config"' deve ser a primeira linha do arquivo de entrada do backend).`
    );
  }
  return valor;
}

/**
 * Lê as opções de conexão do Firebird em tempo de uso (não no import do
 * módulo). Isso evita o bug clássico de "options com campo undefined" que
 * acontece quando o pool é criado antes do dotenv.config() rodar.
 */
export function obterOptions(): Firebird.Options {
  return {
    host: obrigatorio("FIREBIRD_HOST", process.env.FIREBIRD_HOST),
    port: Number(process.env.FIREBIRD_PORT) || 3050,
    database: obrigatorio("FIREBIRD_DATABASE", process.env.FIREBIRD_DATABASE),
    user: obrigatorio("FIREBIRD_USER", process.env.FIREBIRD_USER),
    password: obrigatorio("FIREBIRD_PASSWORD", process.env.FIREBIRD_PASSWORD),
    lowercase_keys: false,
    pageSize: 4096,
  } as Firebird.Options;
}

/** Opções do banco PDV — mesmo padrão, prefixo FIREBIRD_PDV_*. */
export function obterOptionsPdv(): Firebird.Options {
  return {
    host: obrigatorio("FIREBIRD_PDV_HOST", process.env.FIREBIRD_PDV_HOST),
    port: Number(process.env.FIREBIRD_PDV_PORT) || 3050,
    database: obrigatorio("FIREBIRD_PDV_DATABASE", process.env.FIREBIRD_PDV_DATABASE),
    user: obrigatorio("FIREBIRD_PDV_USER", process.env.FIREBIRD_PDV_USER),
    password: obrigatorio("FIREBIRD_PDV_PASSWORD", process.env.FIREBIRD_PDV_PASSWORD),
    lowercase_keys: false,
    pageSize: 4096,
  } as Firebird.Options;
}