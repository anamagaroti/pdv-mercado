import Firebird from "node-firebird";
import { obterOptions } from "./firebird";

/**
 * IMPORTANTE: node-firebird é assíncrono (callback/promise), diferente do
 * better-sqlite3 que era síncrono (db.prepare().get()/.all()/.run()).
 * Por isso toda a stack de produtos (repository/service/controller) precisa
 * ser async/await a partir daqui.
 */

// Ajuste conforme a carga esperada da aplicação.
const TAMANHO_POOL = 5;

// O pool só é criado no primeiro uso (não no import deste módulo). Isso evita
// o bug de conectar com host/database/user/password undefined quando este
// arquivo é importado antes do dotenv.config() rodar.
let pool: any = null;
function obterPool() {
  if (!pool) {
    pool = Firebird.pool(TAMANHO_POOL, obterOptions());
  }
  return pool;
}

function obterConexao(): Promise<any> {
  return new Promise((resolve, reject) => {
    obterPool().get((erro: any, db: any) => {
      if (erro) return reject(erro);
      resolve(db);
    });
  });
}

/**
 * Executa uma única query (SELECT ou INSERT/UPDATE/DELETE, inclusive com
 * RETURNING). O node-firebird abre e resolve uma transação implícita
 * internamente para cada chamada de query().
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await obterConexao();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      db.query(sql, params, (erro: any, resultado: any) => {
        if (erro) return reject(erro);
        resolve((resultado ?? []) as T[]);
      });
    });
  } finally {
    db.detach();
  }
}

/** Atalho semântico para comandos que não retornam linhas (DELETE, etc.). */
export const executar = query;

type QueryFn = (sql: string, params?: any[]) => Promise<any>;

/**
 * Executa um conjunto de operações dentro de uma única transação Firebird.
 * Use quando precisar garantir atomicidade entre múltiplos comandos
 * (ex.: mais de um UPDATE que precisa ser tudo-ou-nada).
 */
export async function transacao<T>(fn: (query: QueryFn) => Promise<T>): Promise<T> {
  const db = await obterConexao();
  try {
    const tx: any = await new Promise((resolve, reject) => {
      db.transaction(Firebird.ISOLATION_READ_COMMITTED, (erro: any, transaction: any) => {
        if (erro) return reject(erro);
        resolve(transaction);
      });
    });

    const queryNaTransacao: QueryFn = (sql, params = []) =>
      new Promise((resolve, reject) => {
        tx.query(sql, params, (erro: any, resultado: any) => {
          if (erro) return reject(erro);
          resolve(resultado ?? []);
        });
      });

    try {
      const resultado = await fn(queryNaTransacao);
      await new Promise<void>((resolve, reject) =>
        tx.commit((erro: any) => (erro ? reject(erro) : resolve()))
      );
      return resultado;
    } catch (erro) {
      await new Promise<void>((resolve, reject) =>
        tx.rollback((erro2: any) => (erro2 ? reject(erro2) : resolve()))
      );
      throw erro;
    }
  } finally {
    db.detach();
  }
}

/** Encerra o pool (útil em testes ou shutdown gracioso da aplicação). */
export async function fecharPool(): Promise<void> {
  if (!pool) return;
  return new Promise((resolve) => pool.destroy(() => resolve()));
}