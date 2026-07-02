import mysql from "mysql2/promise"
import bcrypt from "bcrypt"
import dotenv from "dotenv"

dotenv.config()

const IS_PROD = process.env.NODE_ENV === "production"
const TENANT_GRANT_PRIVS = process.env.MYSQL_TENANT_GRANT_PRIVILEGES ?? "SELECT, INSERT, UPDATE, DELETE"

// Pool central
import centralPool, { getMysqlConnectTimeoutMs } from "./mysql.js"

function slugify(nome) {
  return String(nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
}

function tenantDbName(empresaId, orgNome) {
  return `org_${empresaId}_${slugify(orgNome)}`
}

function mysqlStringLiteral(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

function mysqlUserAccount(user, host) {
  return `${mysqlStringLiteral(user)}@${mysqlStringLiteral(host)}`
}

function mysqlIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``
}

function getAdminConfig() {
  return {
    host: process.env.MYSQL_ADMIN_HOST ?? process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_ADMIN_PORT ?? process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_ADMIN_USER ?? "root",
    password: process.env.MYSQL_ADMIN_PASSWORD ?? "",
    connectTimeout: getMysqlConnectTimeoutMs(),
    multipleStatements: true,
  }
}

const tenantPoolCache = new Map()

function getTenantPool(dbName) {
  if (tenantPoolCache.has(dbName)) return tenantPoolCache.get(dbName)
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: dbName,
    connectTimeout: getMysqlConnectTimeoutMs(),
    waitForConnections: true,
    connectionLimit: 5,
    charset: "utf8mb4",
  })
  tenantPoolCache.set(dbName, pool)
  return pool
}

const TENANT_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS usuarios_auth (
  id_usuario      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  login           VARCHAR(200)     NOT NULL,
  senha_hash      VARCHAR(255)     NOT NULL,
  role            ENUM('ADMIN','GERENTE','VENDEDOR','PAINEL','INDUSTRIA') NOT NULL DEFAULT 'VENDEDOR',
  empresa_id      INT UNSIGNED,
  sk_vendedor     INT,
  nome            VARCHAR(200),
  nome_completo   VARCHAR(300),
  cpf             VARCHAR(20),
  ativo           CHAR(1)          NOT NULL DEFAULT 'S',
  senha_temporaria CHAR(1)         NOT NULL DEFAULT 'N',
  foto_url        TEXT,
  token_version   INT UNSIGNED     NOT NULL DEFAULT 0,
  vendedor_id     INT,
  funcionario_id  INT,
  criado_em       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ultimo_login    DATETIME,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_tenant_usuarios_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

export async function ensureCentralSchema() {
  const [rows] = await centralPool.query(
    "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'organizacoes_auth'"
  )
  const exists = Number(rows[0]?.cnt ?? 0) > 0

  if (!exists) {
    await centralPool.query(`
      CREATE TABLE IF NOT EXISTS organizacoes_auth (
        id_organizacao  INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nome            VARCHAR(200) NOT NULL,
        codigo          VARCHAR(50)  NOT NULL,
        descricao       TEXT,
        ativo           CHAR(1)      NOT NULL DEFAULT 'S',
        oracle_user     VARCHAR(100),
        oracle_password TEXT,
        oracle_connect_string VARCHAR(500),
        db_name         VARCHAR(100),
        criado_em       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id_organizacao),
        UNIQUE KEY uq_organizacoes_nome (nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
  }

  await centralPool.query(`
    CREATE TABLE IF NOT EXISTS usuarios_auth (
      id_usuario      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
      login           VARCHAR(200)     NOT NULL,
      senha_hash      VARCHAR(255)     NOT NULL,
      role            ENUM('SUPERADMIN','ADMIN','GERENTE','VENDEDOR','PAINEL','INDUSTRIA') NOT NULL DEFAULT 'VENDEDOR',
      empresa_id      INT UNSIGNED,
      sk_vendedor     INT,
      nome            VARCHAR(200),
      nome_completo   VARCHAR(300),
      cpf             VARCHAR(20),
      ativo           CHAR(1)          NOT NULL DEFAULT 'S',
      senha_temporaria CHAR(1)         NOT NULL DEFAULT 'N',
      foto_url        TEXT,
      token_version   INT UNSIGNED     NOT NULL DEFAULT 0,
      vendedor_id     INT,
      funcionario_id  INT,
      criado_em       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ultimo_login    DATETIME,
      PRIMARY KEY (id_usuario),
      UNIQUE KEY uq_usuarios_login (login)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  const [admins] = await centralPool.query(
    "SELECT id_usuario FROM usuarios_auth WHERE role = 'SUPERADMIN' LIMIT 1"
  )

  if (!admins.length) {
    const login = process.env.SUPERADMIN_INITIAL_LOGIN ?? "admin"
    const password = process.env.SUPERADMIN_INITIAL_PASSWORD ?? "admin123"
    const hash = await bcrypt.hash(password, 10)
    await centralPool.query(
      "INSERT IGNORE INTO usuarios_auth (login, senha_hash, role, nome, ativo, senha_temporaria) VALUES (?, ?, 'SUPERADMIN', 'Super Admin', 'S', 'N')",
      [login, hash]
    )
    console.log(`[mysql-tenants] SUPERADMIN criado: login=${login}`)
  }

  await ensureUsuariosAuthColumn(centralPool, null, "token_version", "INT UNSIGNED NOT NULL DEFAULT 0")

  const [orgs] = await centralPool.query(
    "SELECT id_organizacao FROM organizacoes_auth WHERE ativo = 'S' AND db_name IS NOT NULL"
  )
  for (const org of orgs) {
    try {
      await ensureTenantUsuariosAuthColumn(org.id_organizacao, "token_version", "INT UNSIGNED NOT NULL DEFAULT 0")
    } catch {}
  }
}

async function ensureUsuariosAuthColumn(pool, databaseName, columnName, definition) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_schema = ${databaseName ? "?" : "DATABASE()"}
      AND table_name = 'usuarios_auth'
      AND column_name = ?
    `,
    databaseName ? [databaseName, columnName] : [columnName]
  )

  if (Number(rows[0]?.cnt ?? 0) === 0) {
    await pool.query(`ALTER TABLE usuarios_auth ADD COLUMN ${columnName} ${definition}`)
  }
}

async function ensureTenantUsuariosAuthColumn(empresaId, columnName, definition) {
  const dbName = await getTenantDbNameByEmpresaId(empresaId)
  if (!dbName) return
  const pool = getTenantPool(dbName)
  await ensureUsuariosAuthColumn(pool, dbName, columnName, definition)
}

async function ensureGrantUserExists(conn, grantUser, userHost) {
  const password = process.env.MYSQL_PASSWORD
  if (!password) {
    throw new Error("MYSQL_PASSWORD e obrigatorio para criar o usuario MySQL do tenant.")
  }

  const account = mysqlUserAccount(grantUser, userHost)
  const passwordLiteral = mysqlStringLiteral(password)
  await conn.query(`CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${passwordLiteral}`)
  await conn.query(`ALTER USER ${account} IDENTIFIED BY ${passwordLiteral}`)

  const centralDb = process.env.MYSQL_DATABASE ?? process.env.MYSQL_DB_NAME ?? process.env.DB_NAME
  if (centralDb) {
    await conn.query(`GRANT ALL PRIVILEGES ON ${mysqlIdentifier(centralDb)}.* TO ${account}`)
  }

  const [tenantDbs] = await conn.query(
    "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME LIKE 'org\\_%' ESCAPE '\\\\'"
  )
  for (const row of tenantDbs) {
    const dbName = row.SCHEMA_NAME ?? row.schema_name
    if (dbName) {
      await conn.query(`GRANT ${TENANT_GRANT_PRIVS} ON ${mysqlIdentifier(dbName)}.* TO ${account}`)
    }
  }
}

export async function ensureTenantDatabaseForOrg(empresaId, orgNome) {
  const grantUser = process.env.MYSQL_GRANT_USER ?? process.env.MYSQL_USER
  const userHost = process.env.MYSQL_USER_HOST ?? "%"

  if (IS_PROD && userHost === "%") {
    throw new Error("Em producao, MYSQL_USER_HOST nao pode ser '%'. Configure um host especifico.")
  }

  const dbName = tenantDbName(empresaId, orgNome)
  const adminCfg = getAdminConfig()
  const conn = await mysql.createConnection(adminCfg)

  let dbAlreadyExisted = true
  try {
    const [existingDbs] = await conn.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [dbName]
    )
    dbAlreadyExisted = existingDbs.length > 0

    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await conn.query(`USE \`${dbName}\``)
    await conn.query(TENANT_SCHEMA_DDL)

    if (grantUser && grantUser !== adminCfg.user) {
      await ensureGrantUserExists(conn, grantUser, userHost)
      await conn.query(
        `GRANT ${TENANT_GRANT_PRIVS} ON \`${dbName}\`.* TO '${grantUser}'@'${userHost}'`
      )
      await conn.query("FLUSH PRIVILEGES")
    }

    await centralPool.query(
      "UPDATE organizacoes_auth SET db_name = ? WHERE id_organizacao = ?",
      [dbName, empresaId]
    )

    return dbName
  } catch (error) {
    if (!dbAlreadyExisted) {
      await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``).catch(() => {})
    }
    throw error
  } finally {
    await conn.end()
  }
}

export async function getTenantDbNameByEmpresaId(empresaId) {
  const [rows] = await centralPool.query(
    "SELECT db_name FROM organizacoes_auth WHERE id_organizacao = ?",
    [empresaId]
  )
  return rows[0]?.db_name ?? null
}

export async function queryTenantByEmpresaId(empresaId, sql, params = []) {
  const dbName = await getTenantDbNameByEmpresaId(empresaId)
  if (!dbName) throw new Error(`Database tenant nao encontrado para empresa_id=${empresaId}`)
  const pool = getTenantPool(dbName)
  const [rows] = await pool.query(sql, params)
  return rows
}

export async function dropTenantDatabaseByEmpresaId(empresaId) {
  const dbName = await getTenantDbNameByEmpresaId(empresaId)
  if (!dbName) return null

  const adminCfg = getAdminConfig()
  const conn = await mysql.createConnection(adminCfg)
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``)
    tenantPoolCache.delete(dbName)
    return dbName
  } finally {
    await conn.end()
  }
}

export async function migrateGlobalVendedoresToTenant(empresaId) {
  const [legados] = await centralPool.query(
    "SELECT * FROM usuarios_auth WHERE empresa_id = ? AND role IN ('VENDEDOR','GERENTE','PAINEL','INDUSTRIA')",
    [empresaId]
  )
  if (!legados.length) return 0

  const dbName = await getTenantDbNameByEmpresaId(empresaId)
  if (!dbName) return 0
  const pool = getTenantPool(dbName)

  let migrated = 0
  for (const u of legados) {
    try {
      await pool.query(
        `INSERT IGNORE INTO usuarios_auth
         (login, senha_hash, role, empresa_id, sk_vendedor, nome, nome_completo, cpf, ativo, senha_temporaria, foto_url, vendedor_id, funcionario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          u.login, u.senha_hash, u.role, u.empresa_id, u.sk_vendedor,
          u.nome, u.nome_completo, u.cpf, u.ativo, u.senha_temporaria,
          u.foto_url, u.vendedor_id, u.funcionario_id,
        ]
      )
      await centralPool.query("DELETE FROM usuarios_auth WHERE id_usuario = ?", [u.id_usuario])
      migrated++
    } catch {}
  }
  return migrated
}

export function describeTenantProvisioningError(error) {
  const msg = String(error?.message ?? "")
  if (msg.includes("ER_ACCESS_DENIED")) return "Acesso negado ao MySQL admin. Verifique MYSQL_ADMIN_USER e MYSQL_ADMIN_PASSWORD."
  if (msg.includes("ER_DBACCESS_DENIED")) return "Permissao negada para criar database. Verifique os privilegios do usuario admin."
  if (msg.includes("ER_NO_SUCH_TABLE")) return "Tabela nao encontrada no tenant. A criacao do schema pode ter falhado."
  if (msg.includes("host nao pode")) return msg
  return `Falha ao provisionar database tenant: ${msg}`
}
