# Relatório de Diagnóstico — NJS-533 (Native Network Encryption / Thick Mode)

**Data:** 2026-07-03
**Escopo:** Investigação read-only. Nenhum código foi alterado, nenhum container foi reiniciado, nenhuma migration foi executada.
**Sintoma relatado:** Bancos Oracle de clientes fora da OCI conectam normalmente. Dois clientes dentro da OCI falham com:
```
NJS-533: Advanced Networking Option service negotiation failed. Native Network Encryption and
DataIntegrity only supported in node-oracledb thick mode.
```

---

## 1. Estrutura do projeto

| Componente | Local | Observações |
|---|---|---|
| Frontend | `Front/` (Next.js) | Dockerfile próprio, build multi-stage, target `prod` |
| Backend API | `Back/` (Node 22 / Express, ESM) | Dockerfile multi-stage, target `prod`/`dev` |
| Jobs assíncronos | `Back/jobs/` (Python 3.12 / Prefect) | Dockerfile próprio, **serviço separado**, não aparece no `docker-compose.yml` raiz |
| MySQL central | serviço `mysql` no compose | Imagem oficial `mysql:8.4`, guarda credenciais Oracle por tenant (tabela `organizacoes_auth`) |
| Orquestração | `docker-compose.yml` (raiz) | 3 serviços: `frontend`, `backend`, `mysql`, rede bridge `app_net` (10.100.10.0/24) |

**Comunicação Front → Back:** o frontend chama endpoints relativos (`/api/...`, ver [Front/lib/api.ts](Front/lib/api.ts)) usando a env `NEXT_PUBLIC_API_URL=http://backend:${BACKEND_PORT}` injetada em build-time via `args` no compose. Dentro da rede Docker o front resolve o hostname `backend` pelo DNS interno do Compose.

**Nota:** o `Back/jobs/Dockerfile` **não está referenciado no `docker-compose.yml`** raiz. Se esse serviço de Prefect estiver rodando em produção, é via outro mecanismo (compose separado, cron, execução manual). Isso é relevante porque esse serviço também acessa Oracle de tenants (ver seção 2.3).

---

## 2. Backend Oracle — arquivos e trechos relevantes

### 2.1 `Back/src/db/oracleClient.js` (módulo central de inicialização)

Este é o único ponto que chama `oracledb.initOracleClient()`. Lógica atual (código já modificado em commits de **hoje**, ver seção 8):

```js
const mode = (process.env.ORACLE_CLIENT_MODE ?? "auto").trim().toLowerCase()
const requireThick =
  mode === "thick" ||
  ["1", "true", "yes"].includes((process.env.ORACLE_REQUIRE_THICK ?? "").trim().toLowerCase())
const forceThin = mode === "thin"
const libDir = process.env.ORACLE_CLIENT_LIB_DIR?.trim()
const shouldInitThick = !forceThin && (requireThick || Boolean(libDir))
```

- Lê `ORACLE_CLIENT_MODE` (`auto` | `thick` | `thin`) e `ORACLE_REQUIRE_THICK`.
- Em Linux, **ignora** `ORACLE_CLIENT_LIB_DIR` de propósito (linha 19-25) — no Linux/Docker o carregamento da lib depende de `ldconfig`/`LD_LIBRARY_PATH` configurados **antes** do Node iniciar, não de `libDir` passado ao `initOracleClient()`.
- Se `shouldInitThick` for `true` e a inicialização falhar, o processo **lança exceção e derruba o app** (comportamento correto — não há fallback silencioso quando thick é exigido):

```js
if (shouldInitThick) {
  try {
    oracledb.initOracleClient(options)
    ...
  } catch (err) {
    throw new Error("[oracle] Nao foi possivel inicializar o modo thick ...")
  }
} else {
  console.log("[oracle] node-oracledb usando thin mode. Defina ORACLE_CLIENT_MODE=thick para exigir Thick mode.")
}

if (requireThick && oracledb.thin) {
  throw new Error("[oracle] ORACLE_CLIENT_MODE=thick exigido, mas o node-oracledb continuou em thin mode.")
}
```

- Expõe `getOracleRuntimeInfo()` (retorna `mode: "thin"|"thick"` e versão do client) e `explainOracleConnectionError()`, que já reconhece explicitamente `NJS-533` e `DPI-1047` e imprime uma mensagem explicativa.
- Existe também `sanitizeConnectString()` para mascarar credenciais em log — usado nos dois módulos abaixo.

**Ponto de atenção:** se `ORACLE_CLIENT_MODE` não chegar ao processo (vazio/indefinido), `mode` cai em `"auto"`. Em modo `auto`, `shouldInitThick` só é `true` se `libDir` estiver definido — em Linux `libDir` é ignorado (ver acima) — logo **`auto` sem `ORACLE_REQUIRE_THICK=true` sempre resulta em thin mode em Linux/Docker, silenciosamente (só um `console.log`, sem erro)**. Esse é o cenário mais provável do incidente — ver seção 8.

### 2.2 `Back/src/db/oracle.js` (pool "legado", único DB fixo via `.env`)

Usa `DB_USER` / `DB_PASSWORD` / `DB_CONNECT_STRING` do ambiente, cria um `oracledb.createPool()` único. Loga `mode` e `connectString` (mascarado) antes de criar o pool. Não é o caminho usado para os bancos multi-tenant dos clientes.

### 2.3 `Back/src/db/oracle-tenants.js` (conexão por cliente/tenant — **é este o caminho relevante para o incidente**)

```js
async function getOracleConfigByEmpresaId(empresaId) {
  const [rows] = await centralPool.query(
    `SELECT id_organizacao, oracle_user, oracle_password, oracle_connect_string
     FROM organizacoes_auth WHERE id_organizacao = ? LIMIT 1`, [empresaId]
  )
  ...
}

export async function queryOracleByEmpresaId(empresaId, sql, binds = {}, options = {}) {
  const { organizationId, ...config } = await getOracleConfigByEmpresaId(empresaId)
  ...
  connection = await oracledb.getConnection(config)
  ...
}
```

- Cada cliente (tenant) tem `oracle_user`/`oracle_password` (criptografado, ver `src/security/secrets.js`)/`oracle_connect_string` armazenados no MySQL central (`organizacoes_auth`).
- Usa `oracledb.getConnection(config)` diretamente (sem pool próprio) por chamada, reaproveitando o **mesmo módulo `oracledb`** singleton inicializado em `oracleClient.js` — ou seja, **thin/thick é global ao processo Node**, não por tenant. Isso confirma: se o processo sobe em thin mode, **todos** os tenants (OCI e não-OCI) rodam em thin; os que não exigem NNE simplesmente não notam.
- Há um fallback de senha (`ORACLE_TENANT_PASSWORD_FALLBACK`) só para falha de **decriptação**, não relacionado a thick/thin — não é a causa do NJS-533, mas vale observar como superfície de risco à parte (regrava a senha decriptada com a chave atual quando o fallback é usado).
- Em caso de erro, loga `mode`, `oracleClientVersion` e connect string mascarada, e chama `explainOracleConnectionError()` — **portanto, se isso já estiver acontecendo em produção, os logs do container devem conter uma linha `[oracle-tenants] falha na conexao Oracle da organizacao ... (mode=thin; ...)`**. Vale procurar por essa linha exata nos logs reais do servidor (ver seção 7).

### 2.4 `Back/jobs/db.py` (serviço Python/Prefect — **não usa thick mode**)

```python
conn = oracledb.connect(
    user=org.get("oracle_user"),
    password=password,
    dsn=org.get("oracle_connect_string"),
)
```

Não há nenhuma chamada equivalente a `oracledb.init_oracle_client()` neste arquivo, nem em `Back/jobs/config.py`/`prefect_flows.py` (não localizada). O `python-oracledb` também nasce em thin mode por padrão. **Se este serviço de jobs também consulta os bancos OCI (via `fetch_organizations` + `oracle_connection`), ele vai falhar com o equivalente Python do NJS-533 (`DPY-3001`) independentemente da correção aplicada no backend Node**, pois:
- `Back/jobs/Dockerfile` não instala Oracle Instant Client;
- não há `LD_LIBRARY_PATH`/`ldconfig` configurado para esse container;
- não há leitura de `ORACLE_CLIENT_MODE` neste serviço.

Isso é relevante caso os "dois clientes OCI" também sejam validados/processados pelos jobs Prefect (ex.: `prefect_flows.py` faz validação periódica por organização).

---

## 3. Dockerfile do backend (`Back/Dockerfile`)

| Item | Situação |
|---|---|
| Imagem base | `node:22-bookworm-slim` |
| Instala Instant Client | Sim, stage `oracle-client`: baixa `instantclient-basiclite-linux.**x64**-21.13.0.0.0dbru.zip` de `download.oracle.com`, extrai para `/opt/oracle/instantclient` |
| Dependências de sistema | `libaio1`, `libnsl2` instaladas nos stages `dev` e `prod` (nomes corretos para Debian 12/bookworm) |
| `ldconfig` | Sim: `echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf && ldconfig` — executado no **build**, gravado na imagem |
| `LD_LIBRARY_PATH` | **Não é definido explicitamente** como `ENV`, mas não é necessário porque o `ldconfig` já registra o path no cache de bibliotecas do SO (`/etc/ld.so.cache`), que é persistido na imagem. Isso é suficiente para `dlopen("libclntsh.so")` funcionar sem `LD_LIBRARY_PATH`. |
| `ORACLE_CLIENT_MODE=thick` | Sim, definido via `ENV` nos stages `dev` e `prod` (linhas 43 e 57) |
| `ORACLE_CLIENT_LIB_DIR` | Não definido no Dockerfile (correto — em Linux é ignorado pelo código, ver 2.1) |
| `ORACLE_REQUIRE_THICK` | Não definido no Dockerfile nem no `.env.docker` — não é necessário, pois `ORACLE_CLIENT_MODE=thick` já ativa `requireThick=true` |
| CMD/ENTRYPOINT | `prod`: `CMD ["npm", "start"]` → `node index.js`. Correto. |
| Arquitetura | **Ponto de atenção:** o zip baixado é fixo para `x64`. Se a imagem for construída/rodar em host **ARM64** (ex.: Graviton, Apple Silicon via Docker Desktop, ou VM ARM na OCI), o Instant Client x64 não vai carregar (`exec format error` / `DPI-1047`), e como `ORACLE_CLIENT_MODE=thick` força `shouldInitThick=true`, o processo **falharia no boot inteiro** (não apenas para os clientes OCI). Como o restante da aplicação está funcionando, isso indica que a arquitetura do host atual é x64 — mas vale confirmar (`uname -m` no host/container). |

**`.dockerignore` do backend** exclui corretamente `.env` e `.env.*` do contexto de build — não há vazamento de segredos para dentro da imagem via esse caminho.

---

## 4. docker-compose.yml

```yaml
backend:
  build:
    context: ./Back
    dockerfile: Dockerfile
    target: prod          # usa o stage "prod" corretamente
  env_file:
    - ./Back/.env.docker  # ORACLE_CLIENT_MODE=thick vem daqui
  environment:
    NODE_ENV: production
    PORT: ${BACKEND_PORT:-3001}
    MYSQL_HOST: mysql
    MYSQL_PORT: 3306
    ...
```

- O serviço `backend` usa o Dockerfile e o stage (`prod`) corretos.
- `env_file: ./Back/.env.docker` carrega `ORACLE_CLIENT_MODE=thick` (confirmado no arquivo, linha 22) — o bloco `environment:` do compose **não sobrescreve** essa variável (só sobrescreve `NODE_ENV`, `PORT`, `MYSQL_*`, `AUTH_COOKIE_NAME`, `ALLOW_DESTRUCTIVE_ORG_DELETE`), então, **no papel**, a variável correta chega ao container.
- `depends_on: mysql (service_healthy)` — não há dependência/healthcheck relacionado ao Oracle. Isso significa que, se o `initOracleClient()` falhar e o processo Node lançar exceção não tratada no `import` de `index.js` (`import './src/db/oracleClient.js'` na linha 2, antes até do Express subir), o **healthcheck do backend nunca fica saudável**, o container entra em restart loop, e o `frontend` (que depende de `backend: service_healthy`) **nunca sobe**. Isso é importante para o diagnóstico: se hoje a aplicação está no ar normalmente para clientes fora da OCI, isso é evidência de que o processo **não está travando no boot** — ou seja, ou (a) thick mode está de fato ativo e funcionando, ou (b) o processo está subindo em thin mode sem exigir thick (`shouldInitThick=false` em runtime), o que só ocorre se `ORACLE_CLIENT_MODE` não estiver chegando como `"thick"` de fato dentro do container em execução.
- Não há `volumes` mapeando Instant Client externo — tudo vem embutido na imagem via multi-stage copy, o que é o padrão recomendado (evita dependência de bind mount do host).
- Rede: `app_net` (bridge, subnet `10.100.10.0/24`). Não há configuração de rede adicional (ex.: rota estática para VPN/túnel OCI) neste compose — a conectividade com a VPN precisa ser garantida pelo **host** e propagada ao container via rede Docker padrão (bridge herda a interface de rede do host/gateway).

---

## 5. Ambiente real do container (backend em produção)

**Não foi possível executar esta etapa nesta sessão.** Esta auditoria rodou a partir do checkout local do repositório (Windows, sem Docker Engine disponível neste ambiente — `docker: command not found`). Os logs locais (`Back/back-stdout.log`) são de uma execução **local/dev no Windows**, não do container de produção:

```
[oracle] node-oracledb inicializado em modo thick (libDir=C:\instantclient_23_5).
```
(prova apenas que o código funciona em thick mode localmente no Windows, usando `ORACLE_CLIENT_LIB_DIR` — não representa o comportamento em Linux/Docker.)

**Ação necessária:** rodar os comandos abaixo diretamente no servidor interno, dentro do container `gestao-metas-backend`:

```bash
# 1. Estado real do runtime oracledb dentro do container
docker exec -it gestao-metas-backend node -e "
import('oracledb').then((m) => {
  const oracledb = m.default;
  console.log({
    thin: oracledb.thin,
    oracleClientVersionString: oracledb.oracleClientVersionString,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    ORACLE_CLIENT_MODE: process.env.ORACLE_CLIENT_MODE,
    ORACLE_REQUIRE_THICK: process.env.ORACLE_REQUIRE_THICK,
    ORACLE_CLIENT_LIB_DIR: process.env.ORACLE_CLIENT_LIB_DIR,
    LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
    TNS_ADMIN: process.env.TNS_ADMIN,
  });
});
"

# 2. Presença física do Instant Client
docker exec gestao-metas-backend find / -name "libclntsh.so*" 2>/dev/null | head -20
docker exec gestao-metas-backend find / -name "libocci.so*" 2>/dev/null | head -20
docker exec gestao-metas-backend ls -la /opt/oracle 2>/dev/null
docker exec gestao-metas-backend ls -la /opt/oracle/instantclient 2>/dev/null
docker exec gestao-metas-backend sh -c 'echo $LD_LIBRARY_PATH'
docker exec gestao-metas-backend sh -c 'echo $TNS_ADMIN'
docker exec gestao-metas-backend uname -m   # confirmar arquitetura x64 vs arm64
docker exec gestao-metas-backend ldconfig -p | grep clntsh   # confirma se o cache do linker enxerga a lib
```

Esse primeiro comando é o mais decisivo: se `thin: true` aparecer mesmo com `ORACLE_CLIENT_MODE=thick` setado, o problema está confirmado — o processo em produção está em thin mode apesar da env estar correta, o que indicaria imagem desatualizada (ver seção 8) ou falha silenciosa em algum ponto anterior à correção de hoje.

---

## 6. Teste de rede para os bancos OCI

Também não executável a partir desta sessão (sem acesso ao servidor/VPN). Comandos sugeridos para rodar **de dentro do container backend** (a imagem `node:22-bookworm-slim` não tem `nc`/`telnet`/`tnsping` por padrão — seguem alternativas):

```bash
# Resolução de nome (se aplicável; pode ser IP direto)
docker exec gestao-metas-backend getent hosts HOST_OCI_MASCARADO

# Teste de porta TCP 1521 sem depender de netcat (usa o próprio Node):
docker exec gestao-metas-backend node -e "
const net = require('net');
const s = net.createConnection({ host: 'HOST_OCI_MASCARADO', port: 1521, timeout: 5000 }, () => {
  console.log('TCP OK'); s.end();
});
s.on('error', (e) => console.log('TCP FAIL', e.message));
s.on('timeout', () => console.log('TCP TIMEOUT'));
"

# Se preferir nc/tnsping, instalar temporariamente (não persiste, container é efêmero em rebuild):
docker exec gestao-metas-backend sh -c "apt-get update && apt-get install -y --no-install-recommends netcat-openbsd && nc -vz HOST_OCI_MASCARADO 1521"
```

**Importante:** validar isso **de dentro do container**, não apenas do host — a rede Docker bridge (`app_net`, `10.100.10.0/24`) depende do roteamento do host para a VPN/túnel estar corretamente propagado (masquerade/NAT ou rota). É comum a VPN funcionar no host e não ser alcançável de dentro de um container bridge se não houver rota apropriada ou se a VPN estiver configurada para bind apenas na interface do host.

Se a porta 1521 **não responder** a partir do container (mas responder do host), a causa seria puramente de rede/roteamento Docker — **não relacionada a thin/thick** — e mascararia/combinaria com o problema de NNE. Recomendo descartar essa hipótese primeiro com o teste TCP acima, já que o erro NJS-533 especificamente só ocorre **depois** que a conexão TCP e o handshake inicial do protocolo Oracle Net acontecem (ver seção 8).

---

## 7. Logs

Nos arquivos versionados/locais (`Back/back-stdout.log`, `Back/back-stderr.log`) não há nenhuma ocorrência de `NJS-533`, `DPI-1047`, `ORA-`, `mode=thin` ou `mode=thick` — esses logs são de uma execução local de desenvolvimento no Windows (mostram `[oracle] node-oracledb inicializado em modo thick (libDir=C:\instantclient_23_5)`, caminho que só existe em máquina Windows), **não são os logs do container de produção**.

**Ação necessária no servidor:**
```bash
docker logs gestao-metas-backend --since 24h | grep -E "NJS-533|NJS-|DPI-1047|mode=thin|mode=thick|oracleClientVersion|initOracleClient|ORA-"
```
Procurar especificamente pela linha de boot:
```
[oracle] node-oracledb inicializado em modo thick (...)
```
ou
```
[oracle] node-oracledb usando thin mode. Defina ORACLE_CLIENT_MODE=thick para exigir Thick mode.
```
Essa linha aparece uma única vez, no boot do processo (primeira linha após o `npm start`), e responde sozinha à pergunta central deste diagnóstico.

---

## 8. Diagnóstico

### O backend está rodando em thin ou thick?
**Indeterminado a partir desta sessão** (sem acesso ao container de produção) — mas a hipótese mais provável, com alta confiança, é **thin mode em produção no momento do incidente**, com base em:

1. O erro NJS-533 só ocorre em thin mode por definição — os dois clientes OCI provavelmente têm `SQLNET.ENCRYPTION_SERVER=REQUIRED` (ou `DATA_INTEGRITY_SERVER=REQUIRED`) no `sqlnet.ora`, enquanto os demais clientes não exigem NNE — isso explica por que só esses dois falham mesmo com `mode` sendo global ao processo (thin/thick não é por conexão, é por processo Node inteiro).
2. **O código que força thick mode de forma robusta (`ORACLE_CLIENT_MODE=thick` com exceção obrigatória em vez de fallback silencioso) foi commitado *hoje*** (`c07936a "fix: enable oracle thick mode runtime"`, `738a0f0`, `89e6d02`, todos datados de 2026-07-02). O comentário original removido no primeiro desses commits dizia literalmente: *"Se o Instant Client não for encontrado, segue em modo thin para não quebrar ambientes sem essa dependência"* — ou seja, **a versão anterior do código tinha fallback silencioso para thin mode**, exatamente o padrão de bug que causa este sintoma.
3. Isso sugere fortemente que o comportamento observado em produção reflete a **imagem/deploy anterior a essa correção**, e o código atual no repositório já é a correção — mas ela só terá efeito depois de **rebuild da imagem backend + redeploy do container**.

### O Oracle Instant Client existe dentro do container?
No `Dockerfile`, sim — é baixado e instalado corretamente no build (stage `oracle-client`, copiado para `prod`/`dev`). Não há evidência de erro na etapa de download/instalação nesta auditoria estática. **Confirmar fisicamente com os comandos da seção 5** (a imagem em execução no servidor pode ser mais antiga que o `Dockerfile` atual do repositório).

### O docker-compose usa o Dockerfile correto?
Sim. `context: ./Back`, `dockerfile: Dockerfile`, `target: prod` — todos corretos e apontam para o Dockerfile auditado.

### As envs Oracle estão chegando no container?
No papel, sim: `env_file: ./Back/.env.docker` contém `ORACLE_CLIENT_MODE=thick`, e o bloco `environment:` do compose não sobrescreve essa chave. **Precisa ser confirmado em runtime** (seção 5) porque é o elo mais provável de falha caso o servidor real use um `.env.docker` diferente do versionado, ou caso o deploy não recarregue env_file após mudança (containers precisam ser recriados — `up -d`/recreate — para novo `env_file` ter efeito, um simples `restart` não é suficiente se o arquivo mudou após o container já existir).

### Existe fallback silencioso para thin?
No código **atual** do repositório, não, para o caso `ORACLE_CLIENT_MODE=thick` explícito (o processo lança erro fatal se não conseguir). Porém, no modo `auto` (valor default se a env não for lida), o fallback para thin **é silencioso** (apenas um `console.log`, sem exceção) — esse é o comportamento residual mais perigoso hoje: se por qualquer motivo `ORACLE_CLIENT_MODE` chegar vazio no container (não `thick`), o app sobe normalmente em thin mode sem qualquer alarme, e só os bancos que exigem NNE vão revelar o problema, exatamente como está acontecendo.

Adicionalmente, `Back/jobs/db.py` (serviço Python) **não tem nenhum mecanismo de thick mode implementado** — é sempre thin, sem alarme algum.

### O erro acontece antes ou depois da autenticação Oracle?
**Antes.** NJS-533 ocorre durante a negociação do protocolo Oracle Net (fase de "Advanced Networking Option" / NNE), que acontece logo após o handshake TCP e antes da troca de credenciais de autenticação. Ou seja, a rede/VPN até o host:1521 está funcionando (senão o erro seria de timeout/conexão recusada, não NJS-533); o processo Node consegue abrir o socket, mas a biblioteca cliente (thin) não sabe negociar criptografia/integridade nativa exigida pelo servidor, e a conexão é abortada antes mesmo de enviar usuário/senha.

### O container enxerga a rede/VPN dos bancos OCI?
Presumivelmente sim, dado que o erro reportado é NJS-533 (pós-TCP) e não um erro de timeout/rede — mas isso deve ser **confirmado explicitamente** com os testes da seção 6, pois esta auditoria não teve acesso ao servidor. Se fosse um problema de rede, o erro esperado seria diferente (ex.: `ORA-12170: TNS:Connect timeout occurred` ou `ECONNREFUSED`), não NJS-533.

### Qual é a causa mais provável?
**O processo Node em produção está (ou estava, no momento do incidente relatado) rodando `node-oracledb` em thin mode**, porque a correção que força thick mode de forma robusta (`ORACLE_CLIENT_MODE=thick` + exceção obrigatória) é uma mudança de código muito recente (mesma data de hoje) que provavelmente ainda não foi propagada para a imagem Docker rodando no servidor (requer rebuild + recreate do container `backend`, não apenas restart). Os clientes fora da OCI não exigem Native Network Encryption/Data Integrity no `sqlnet.ora`, por isso não expõem o problema; os dois clientes OCI exigem, e por isso falham com NJS-533 — sintoma clássico de "thin mode ativo, mas nem todo servidor Oracle tolera thin mode".

Causas secundárias a não descartar até confirmação em runtime:
- Arquitetura do host divergente de x64 (o Instant Client baixado no Dockerfile é fixo para `linux.x64`).
- `.env.docker` real no servidor divergente do versionado no repositório (ex.: sem `ORACLE_CLIENT_MODE=thick`, ou com typo).
- Container não recriado após alteração do `env_file` (env_file só é relido na recriação do container, não em `restart`).
- Se o job Prefect (`Back/jobs`) também tocar esses dois clientes OCI, ele falhará por conta própria (thin mode sempre, sem Instant Client instalado), independente da correção no backend Node.

### Qual correção recomenda aplicar?
1. **Confirmar em runtime** (seção 5) que `oracledb.thin === false` e `oracleClientVersionString` populado dentro do container `gestao-metas-backend` atualmente em execução — sem isso, qualquer ação é especulativa.
2. Se `thin: true` for confirmado: **rebuildar a imagem backend a partir do Dockerfile/commit atual** (`docker compose build backend`) e **recriar o container** (`docker compose up -d --force-recreate backend`) — não apenas `restart`, pois `env_file` só é relido na recriação.
3. Validar pós-deploy com o script já existente `Back/test-oracle.js` (`npm run oracle:smoke` dentro do container) para o Oracle legado, e um teste equivalente ad hoc usando `queryOracleByEmpresaId` para os dois `empresa_id` dos clientes OCI, checando o log `[oracle] node-oracledb inicializado em modo thick`.
4. Confirmar arquitetura do host (`uname -m`) é compatível com o Instant Client x64 baixado no Dockerfile; se o host for ARM64, trocar a URL de download para `instantclient-basiclite-linux.arm64-*`.
5. Decidir e alinhar o comportamento de fallback em modo `auto`: hoje é silencioso. Se a intenção é sempre exigir thick em produção (dado que pelo menos alguns clientes exigem NNE), considerar deixar `ORACLE_CLIENT_MODE=thick` como está em `.env.docker` (já é o caso) e não depender do modo `auto` em nenhum ambiente de produção.
6. Endereçar `Back/jobs/` separadamente: se esse serviço também acessa os bancos OCI, ele precisa do mesmo tratamento (Instant Client + `oracledb.init_oracle_client()` no Python, usando a mesma lib já instalada, ou reaproveitando a imagem/volume do backend).
7. Somente depois dessas confirmações, agendar o rebuild/redeploy com o cliente avisado (ação de infraestrutura com impacto em produção — fora do escopo desta auditoria read-only).

---

## Observação de segurança

Durante a auditoria foram lidos, mas **não reproduzidos neste relatório**, os seguintes segredos em `Back/.env`, `Back/.env.docker` e `Back/.env.example`: `AUTH_TOKEN_SECRET`, `APP_ENCRYPTION_KEY`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_ADMIN_PASSWORD`, `DB_PASSWORD`, `ORACLE_TENANT_PASSWORD_FALLBACK`, `SUPERADMIN_INITIAL_PASSWORD`, `ADMIN_RESET_TOKEN`, além do IP interno do Oracle legado (`DB_CONNECT_STRING`). Nenhum valor real foi incluído neste documento, conforme solicitado.
