import mysql from "mysql2/promise"
import "../config/env.js"

function readPositiveInt(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getMysqlConnectTimeoutMs() {
  return readPositiveInt(process.env.MYSQL_CONNECT_TIMEOUT_MS, 5000)
}

function getMysqlConfig({ admin = false } = {}) {
  if (admin) {
    return {
      host: process.env.MYSQL_ADMIN_HOST ?? process.env.MYSQL_HOST ?? process.env.DB_HOST ?? "localhost",
      port: Number(process.env.MYSQL_ADMIN_PORT ?? process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_ADMIN_USER ?? "root",
      database: process.env.MYSQL_DATABASE ?? process.env.MYSQL_DB_NAME ?? process.env.DB_NAME ?? "gestao_metas",
      connectTimeout: getMysqlConnectTimeoutMs(),
    }
  }

  return {
    host: process.env.MYSQL_HOST ?? process.env.DB_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DATABASE ?? process.env.MYSQL_DB_NAME ?? process.env.DB_NAME ?? "gestao_metas",
    connectTimeout: getMysqlConnectTimeoutMs(),
  }
}

export function describeMysqlTarget(options) {
  const cfg = getMysqlConfig(options)
  return `${cfg.user ?? "(sem usuario)"}@${cfg.host ?? "(sem host)"}:${cfg.port}/${cfg.database}`
}

export function formatDbError(error) {
  if (!error) return "erro desconhecido"
  if (typeof error === "string") return error

  const details = [
    error.code,
    error.errno ? `errno=${error.errno}` : null,
    error.sqlState ? `sqlState=${error.sqlState}` : null,
    error.address ? `address=${error.address}` : null,
    error.port ? `port=${error.port}` : null,
    error.message,
  ].filter(Boolean)

  if (Array.isArray(error.errors) && error.errors.length) {
    details.push(
      ...error.errors.map((item) => formatDbError(item))
    )
  }

  if (error.cause) details.push(`cause=${formatDbError(error.cause)}`)

  return details.length ? details.join(" | ") : String(error)
}

export function hasMysqlConfig() {
  return Boolean(
    (process.env.MYSQL_HOST ?? process.env.DB_HOST) &&
    process.env.MYSQL_USER &&
    process.env.MYSQL_PASSWORD &&
    (process.env.MYSQL_DATABASE ?? process.env.MYSQL_DB_NAME ?? process.env.DB_NAME)
  )
}

const cfg = getMysqlConfig()
const pool = mysql.createPool({
  host: cfg.host,
  user: cfg.user,
  password: process.env.MYSQL_PASSWORD,
  database: cfg.database,
  port: cfg.port,
  connectTimeout: cfg.connectTimeout,
  waitForConnections: true,
  connectionLimit: 10
})

export default pool
