# Relatorio de Correcao e Validacao - Oracle Thick Mode

Data: 2026-07-03

## Resumo

O erro abaixo ocorria ao testar/conectar em bases Oracle que exigem Native Network Encryption/Data Integrity:

```text
NJS-533: Advanced Networking Option service negotiation failed.
Native Network Encryption and DataIntegrity only supported in node-oracledb thick mode.
```

A causa confirmada foi que o processo Node do backend ainda estava rodando o `node-oracledb` em Thin Mode em pelo menos um fluxo de execucao. A aplicacao precisava iniciar o Oracle Client em Thick Mode antes de qualquer conexao Oracle.

## Causa Raiz

O projeto ja tinha suporte a Thick Mode, mas havia risco de o backend nao carregar corretamente o arquivo `Back/.env` dependendo do diretorio usado para iniciar o Node.

Exemplo do problema:

- Se o processo fosse iniciado de dentro de `Back`, o `dotenv/config` encontrava `Back/.env`.
- Se o processo fosse iniciado pela raiz do repositorio ou por outro processo, o `dotenv/config` procurava `.env` no diretorio atual.
- Nesse caso, variaveis como `ORACLE_CLIENT_MODE=thick`, `ORACLE_REQUIRE_THICK=true` e `ORACLE_CLIENT_LIB_DIR` podiam nao chegar ao processo Node.
- Sem essas variaveis, o `node-oracledb` podia permanecer em Thin Mode, causando `NJS-533` contra servidores Oracle que exigem Advanced Networking.

## Correcoes Aplicadas

### 1. Thick Mode obrigatorio

Arquivos ajustados:

- `Back/.env.docker`
- `Back/.env.example`
- `Back/src/db/oracleClient.js`

Configuracao esperada:

```env
ORACLE_CLIENT_MODE=thick
ORACLE_REQUIRE_THICK=true
```

No ambiente Windows local, tambem e necessario apontar o Instant Client:

```env
ORACLE_CLIENT_LIB_DIR=C:\instantclient_23_5
```

No Docker/Linux, o caminho do Instant Client e configurado no `Dockerfile` via `ldconfig`, e o `ORACLE_CLIENT_LIB_DIR` nao deve ser usado.

### 2. Carregamento centralizado do ambiente

Foi criado o arquivo:

```text
Back/src/config/env.js
```

Ele carrega explicitamente:

```text
Back/.env
```

Isso remove a dependencia do diretorio atual do processo Node.

Antes:

```js
import "dotenv/config"
```

Depois:

```js
import "../config/env.js"
```

ou, no `Back/index.js`:

```js
import "./src/config/env.js"
```

### 3. Endpoint de teste agora informa o modo Oracle

O endpoint:

```text
POST /api/superadmin/organizacoes/test-conexao
```

passou a retornar tambem:

```json
{
  "oracleMode": "thick",
  "oracleClientVersion": "23.5.0.24.7"
}
```

Isso permite validar pela tela/API se a instancia ativa esta realmente em Thick Mode.

## Commits Relevantes

```text
0a89941 fix: load backend env before oracle init
4b4f035 fix: force oracle thick mode
c07936a fix: enable oracle thick mode runtime
738a0f0 Centraliza inicializacao Oracle thick
89e6d02 Atualiza conexoes e suporte Oracle thick
```

## Evidencias de Validacao Local

Foram executados dois testes locais.

### 1. Smoke test a partir da pasta Back

Comando:

```bash
npm.cmd run oracle:smoke
```

Resultado esperado/obtido:

```text
[oracle] node-oracledb inicializado em modo thick (libDir=C:\instantclient_23_5; client=23.5.0.24.7).
[oracle-smoke] mode=thick; client=23.5.0.24.7
Conectado com sucesso ao Oracle.
```

### 2. Smoke test a partir da raiz do projeto

Comando:

```bash
node Back\test-oracle.js
```

Resultado esperado/obtido:

```text
[oracle] node-oracledb inicializado em modo thick (libDir=C:\instantclient_23_5; client=23.5.0.24.7).
[oracle-smoke] mode=thick; client=23.5.0.24.7
Conectado com sucesso ao Oracle.
```

Esse segundo teste valida especificamente a correcao do carregamento de `Back/.env` fora do diretorio `Back`.

## Checklist de Validacao em Producao/Docker

### 1. Atualizar codigo no servidor

```bash
git pull
```

Confirmar que o commit `0a89941` esta presente:

```bash
git log --oneline -5
```

### 2. Recriar o backend

Nao basta apenas reiniciar o container se houve mudanca de imagem/env. Recriar com build:

```bash
docker compose up -d --build backend
```

Se o frontend depender do healthcheck do backend, pode ser usado:

```bash
docker compose up -d --build
```

### 3. Validar logs do backend

Comando:

```bash
docker logs gestao-metas-backend
```

Procurar por:

```text
[oracle] node-oracledb inicializado em modo thick
```

Se aparecer:

```text
[oracle] node-oracledb usando thin mode
```

a instancia ainda nao esta corrigida ou esta rodando um container/processo antigo.

### 4. Validar ambiente dentro do container

Comando:

```bash
docker exec gestao-metas-backend node -e "import('oracledb').then((m)=>{const o=m.default; console.log({ thin:o.thin, client:o.oracleClientVersionString })})"
```

Resultado esperado apos a inicializacao correta pelo backend:

```text
thin: false
client: valor preenchido
```

Observacao: o teste mais confiavel e o log do backend ou o endpoint de teste, porque eles passam pelo mesmo modulo `Back/src/db/oracleClient.js` usado pela aplicacao.

### 5. Validar pelo endpoint/tela

No cadastro/teste de organizacao, executar o teste de conexao Oracle.

Resultado esperado:

```json
{
  "ok": true,
  "oracleMode": "thick"
}
```

Se houver erro de credencial, rede ou service name, ele sera diferente de `NJS-533`. O ponto principal desta validacao e confirmar que `oracleMode` esta como `thick`.

## Diagnostico se o NJS-533 Voltar

Se o erro `NJS-533` voltar, verificar nesta ordem:

1. A requisicao esta chegando no container correto?
2. O container foi recriado depois do `git pull`?
3. O log do backend mostra `modo thick` no boot?
4. O endpoint de teste retorna `oracleMode: "thick"`?
5. Existe outra instancia antiga do backend rodando na mesma porta ou atras do proxy?
6. O servidor esta usando o mesmo repositorio/branch `main` atualizado?

Se o processo estiver realmente em Thick Mode, o erro `NJS-533` nao deve ocorrer. Nesse caso, qualquer nova falha tende a ser outro problema, como credenciais, rota de rede, listener, service name/SID ou permissao Oracle.

## Conclusao

A falha foi causada por execucao do `node-oracledb` em Thin Mode em um ambiente que exigia recursos suportados apenas em Thick Mode. A correcao tornou o carregamento do ambiente deterministico, passou a exigir Thick Mode e adicionou retorno de diagnostico no endpoint de teste de conexao.

Estado validado localmente:

```text
Oracle Mode: thick
Oracle Client: 23.5.0.24.7
Conexao Oracle: sucesso
```

