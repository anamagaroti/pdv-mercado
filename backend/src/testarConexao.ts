import "dotenv/config"; // sempre a primeira linha
import { query, fecharPool } from "./db/firebirdPool";

async function main() {
  console.log("Tentando conectar no Firebird...");
  try {
    // RDB$DATABASE é uma tabela de sistema que sempre existe, serve só
    // pra confirmar que a conexão e as credenciais estão OK.
    const resultado = await query("SELECT CURRENT_TIMESTAMP AS AGORA FROM RDB$DATABASE");
    console.log("✅ Conectado com sucesso! Hora do servidor Firebird:", resultado[0].AGORA);

    // Bônus: confirma que a tabela PRODUTOS existe e é visível
    const total = await query("SELECT COUNT(*) AS TOTAL FROM PRODUTOS");
    console.log(`✅ Tabela PRODUTOS acessível, total de registros: ${total[0].TOTAL}`);
  } catch (erro: any) {
    console.error("❌ Falha na conexão:", erro.message);
    process.exitCode = 1;
  } finally {
    await fecharPool();
  }
}

main();