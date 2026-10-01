import Firebird from "node-firebird";
import { obterOptions, obterOptionsPdv } from "./firebird";

/**
 * IMPORTANTE: node-firebird é assíncrono (callback/promise), diferente do
 * better-sqlite3 que era síncrono (db.prepare().get()/.all()/.run()).
 * Por isso toda a stack de produtos (repository/service/controller) precisa
 * ser async/await a partir daqui.
 */

const TAMANHO_POOL = 5;

type QueryFn = (sql: string, params?: any[]) => Promise<any>;

/**
 * Fábrica interna: dado um obtainer de options, devolve o conjunto
 * {query, executar, transacao, fecharPool} isolado para aquele banco.
 * Usada só para criar os pares "comer" (padrão) e "pdv" abaixo — não
 * precisa ser exportada nem usada diretamente fora deste arquivo.
 */
function criarClienteFirebird(obterOpcoes: () => Firebird.Options) {
  let pool: any = null;

  function obterPool() {
    if (!pool) {
      pool = Firebird.pool(TAMANHO_POOL, obterOpcoes());
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

  async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
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

  async function transacao<T>(fn: (query: QueryFn) => Promise<T>): Promise<T> {
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

  async function fecharPool(): Promise<void> {
    if (!pool) return;
    return new Promise((resolve) => pool.destroy(() => resolve()));
  }

  return { query, transacao, fecharPool };
}

// Banco principal (fixo) — mesma API de antes, nenhuma chamada existente quebra.
const clienteComer = criarClienteFirebird(obterOptions);
export const query = clienteComer.query;
export const executar = clienteComer.query; // atalho semântico, igual antes
export const transacao = clienteComer.transacao;

// Banco secundário — use explicitamente onde precisar do PDV.
const clientePdv = criarClienteFirebird(obterOptionsPdv);
export const queryPdv = clientePdv.query;
export const executarPdv = clientePdv.query;
export const transacaoPdv = clientePdv.transacao;

/** Encerra os dois pools (útil em testes ou shutdown gracioso da aplicação). */
export async function fecharPools(): Promise<void> {
  await Promise.all([clienteComer.fecharPool(), clientePdv.fecharPool()]);
}