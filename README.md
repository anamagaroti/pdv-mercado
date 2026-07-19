# Sistema de Cadastro e Validação de Produtos

Ferramenta auxiliar para agilizar o cadastro, conferência e validação de NCM
de produtos de mercado, usando leitor de código de barras USB.

## Como rodar

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev      # http://localhost:3002
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:5172 (proxy automático para /api -> :3001)
```

Na primeira execução, o backend cria automaticamente o banco SQLite em
`backend/data/cadastro.db` a partir de `src/db/schema.sql`.

## O que já está pronto (v1)

- **Schema SQLite completo**: produtos, histórico de alterações, cache de
  validação de NCM, log de importações e configurações — o banco é a fonte
  de verdade, como combinamos.
- **Cadastro/conferência**: tela com campo de leitura em destaque, fluxo
  completo de "produto existe" (edição) e "produto não existe" (cadastro
  rápido com tentativa de consulta externa via Open Food Facts + busca por
  similaridade com Fuse.js + Jaccard, ignorando marcas conhecidas).
- **Validador de NCM**: consulta a tabela oficial do Portal Siscomex
  (gratuita, sem necessidade de chave), com cache em banco para evitar
  consultas repetidas, e tela de resultados com filtros e estatísticas.
- **Importação**: upload de .xlsx, detecção automática de colunas com
  mapeamento ajustável, upsert no banco (não recria do zero).
- **Dashboard**: contadores de produtos, novos, alterados, NCMs ausentes etc.
- **Tema visual escuro** com identidade própria (campo de leitura com brilho
  âmbar simulando um leitor óptico).

## Pontos de atenção / próximos passos

1. **Banco de dados via `node:sqlite`**: o sistema usa o módulo SQLite
   nativo do próprio Node.js (não depende mais de `better-sqlite3`), então
   não há nenhuma compilação nativa na instalação — `npm install` é rápido
   e não depende de Python/Xcode/build tools. **Requisito: Node.js >= 22.5**
   (recomendado >= 23.4, quando o módulo deixou de exigir a flag
   `--experimental-sqlite`). Verifique sua versão com `node -v`. Testamos o
   servidor rodando de ponta a ponta (criação, listagem, dashboard e busca
   por similaridade) e está funcionando.
2. **Leitor de código de barras**: o campo já fica sempre em foco e captura
   Enter automaticamente — funciona com qualquer leitor USB configurado como
   teclado, sem necessidade de driver adicional.
3. **Migração futura para PostgreSQL**: o acesso ao banco está isolado em
   `db/database.ts` e os serviços usam apenas SQL padrão (sem recursos
   específicos do SQLite além do `ON CONFLICT`), o que facilita a troca.
4. **Exportação para Excel** e **histórico de alterações na interface** estão
   no schema/backend mas ainda sem tela própria no frontend — ficaram
   "preparados" como pedido no escopo, não implementados de ponta a ponta.
5. Recomendo testar a importação primeiro com uma amostra pequena da
   planilha real antes de rodar os ~8.000 produtos de uma vez, para validar
   se o dicionário de colunas reconhece os nomes específicos da sua planilha.
