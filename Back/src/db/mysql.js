import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

export function hasMysqlConfig() {
  return Boolean(
    (process.env.MYSQL_HOST ?? process.env.DB_HOST) &&
    (process.env.MYSQL_USER ?? process.env.DB_USER) &&
    (process.env.MYSQL_PASSWORD ?? process.env.DB_PASSWORD) &&
    (process.env.MYSQL_DB_NAME ?? process.env.DB_NAME)
  )
}

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? process.env.DB_HOST,
  user: process.env.MYSQL_USER ?? process.env.DB_USER,
  password: process.env.MYSQL_PASSWORD ?? process.env.DB_PASSWORD,
  database: process.env.MYSQL_DB_NAME ?? process.env.DB_NAME,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  waitForConnections: true,
  connectionLimit: 10
})

export default pool
