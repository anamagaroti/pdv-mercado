import { DatabaseSync, StatementSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'cadastro.db');

// Garante que a pasta do banco exista (ex: ./data)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/**
 * Usamos o módulo nativo `node:sqlite` (embutido no Node.js a partir da
 * v22.5, sem necessidade de flag desde a v23.4) em vez de `better-sqlite3`.
 * Isso elimina por completo a etapa de compilação nativa (node-gyp) na
 * instalação — que é frágil e quebra com frequência em versões novas do
 * Node, como aconteceu com o better-sqlite3 em Node 25.
 *
 * Requisito: Node.js >= 22.5 (recomendado >= 23.4, onde o módulo deixou de
 * exigir a flag --experimental-sqlite).
 */
const raw = new DatabaseSync(DB_PATH);

raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA synchronous = NORMAL');
raw.exec('PRAGMA foreign_keys = ON');

/**
 * Envolve uma função em uma transação (BEGIN/COMMIT/ROLLBACK), replicando
 * a API de `db.transaction(fn)` do better-sqlite3 que o resto do código já
 * usa, para não precisar alterar os módulos que a consomem.
 */
function transaction<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => {
    raw.exec('BEGIN');
    try {
      const resultado = fn(...args);
      raw.exec('COMMIT');
      return resultado;
    } catch (erro) {
      try {
        raw.exec('ROLLBACK');
      } catch {
        // se o ROLLBACK falhar (ex: transação já desfeita), ignora
      }
      throw erro;
    }
  }) as T;
}

export const db = {
  prepare(sql: string): StatementSync {
    return raw.prepare(sql);
  },
  exec(sql: string): void {
    raw.exec(sql);
  },
  transaction,
};

export function initDatabase(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  raw.exec(schema);
  console.log(`[db] SQLite (node:sqlite) inicializado em ${DB_PATH}`);
}

export default db;
